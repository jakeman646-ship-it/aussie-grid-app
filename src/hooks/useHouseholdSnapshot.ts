/**
 * Aussie Grid — Hooks
 * File: src/hooks/useHouseholdSnapshot.ts
 * Version: v0.1.2.30
 * Updated: 11 Oct 2026 — missing grid / SOC stay null; yesterday battery + export $ for the hint.
 */
import { useState, useEffect } from "react";
import { supabase, queryTimeout } from "@/lib/supabase";
import { getYesterdayBrisbaneDate } from "@/lib/calculateSavings";

export interface HouseholdSnapshot {
  household_id: string;
  mode: string;
  reason: string;
  /** Null when the latest reading has no SOC. */
  battery_soc: number | null;
  solar_kw: number;
  /** Null when the latest reading has no grid figure — never coerce to 0. */
  grid_kw: number | null;
  consumption_kw: number;
  yesterday_savings_aud: number | null;
  yesterday_battery_discharge_aud: number | null;
  yesterday_export_aud: number | null;
  cumulative_savings_aud: number | null;
  last_updated: string;
  data_source: string;
  days_of_data: number;
  data_quality_note: string;
}

interface UseHouseholdSnapshotOptions {
  /** When true, query failures return an empty snapshot instead of blocking the dashboard. */
  isImpersonating?: boolean;
  /** False for NSW / unpriced households — readings stay; Ergon $ must not appear. */
  dollarsPriced?: boolean;
}

interface UseHouseholdSnapshotResult {
  data: HouseholdSnapshot | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/** PostgREST / RLS failures that must not look like "waiting on first pull". */
function isLikelyPermissionOrSchemaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; status?: number };
  const msg = (e.message ?? "").toLowerCase();
  const code = String(e.code ?? "");
  if (e.status === 401 || e.status === 403) return true;
  if (code === "42501" || code === "PGRST301" || code === "PGRST302") return true;
  if (/permission denied|not authorized|jwt|row-level security|rls|403|401/i.test(msg)) {
    return true;
  }
  if (/column .* does not exist|could not find.*column/i.test(msg)) return true;
  return false;
}

function formatSnapshotFetchError(err: unknown): string {
  if (isLikelyPermissionOrSchemaError(err)) {
    const msg = String(
      err && typeof err === "object" && "message" in err
        ? (err as { message?: string }).message ?? ""
        : "",
    ).toLowerCase();
    const tableHint = /daily_savings/i.test(msg)
      ? "daily_savings"
      : "household_readings / daily_savings";
    return (
      `Cannot load ${tableHint === "daily_savings" ? "Estimated savings" : "live data"} ` +
      `(permission or schema). Check ${tableHint} RLS / grants for this signed-in account.`
    );
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = String((err as { message?: string }).message ?? "").trim();
    if (m) return m;
  }
  return "Failed to load household snapshot";
}

/** Minimal snapshot before telemetry exists (impersonation / new connection). */
function buildEmptySnapshot(householdId: string): HouseholdSnapshot {
  return {
    household_id: householdId,
    mode: "self_consume",
    reason: "Preparing your first readings — suggestions appear once live data arrives",
    battery_soc: null,
    solar_kw: 0,
    grid_kw: null,
    consumption_kw: 0,
    yesterday_savings_aud: null,
    yesterday_battery_discharge_aud: null,
    yesterday_export_aud: null,
    cumulative_savings_aud: null,
    last_updated: new Date().toISOString(),
    data_source: "no_data",
    days_of_data: 0,
    data_quality_note: "No live readings yet — your dashboard will fill in after the first successful data pull",
  };
}

const SAVINGS_COLUMNS = "savings_date, savings_aud, battery_discharge_aud, export_aud";
const SAVINGS_CORE_COLUMNS = "savings_date, savings_aud";

type SavingsLogRow = {
  savings_date: string;
  savings_aud: number | null;
  battery_discharge_aud?: number | null;
  export_aud?: number | null;
};

function optionalNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function useHouseholdSnapshot(
  householdId: string,
  options: UseHouseholdSnapshotOptions = {},
): UseHouseholdSnapshotResult {
  const { isImpersonating = false, dollarsPriced = true } = options;
  const [data, setData] = useState<HouseholdSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSnapshot = async () => {
    setLoading(true);
    setError(null);

    try {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

      const fetchSavingsLog = (columns: string) =>
        supabase
          .from("daily_savings")
          .select(columns)
          .eq("household_id", householdId)
          .gte("savings_date", since.split("T")[0])
          .order("savings_date", { ascending: false })
          .abortSignal(queryTimeout());

      const [readingsResult, firstSavingsResult] = await Promise.all([
        supabase
          .from("household_readings")
          .select(
            "timestamp, consumption_kw, grid_kw, solar_kw, battery_power_kw, battery_soc_percent",
          )
          .eq("household_id", householdId)
          .gte("timestamp", since)
          .order("timestamp", { ascending: true })
          .abortSignal(queryTimeout()),
        fetchSavingsLog(SAVINGS_COLUMNS),
      ]);

      if (readingsResult.error) throw readingsResult.error;

      // Older grants may not expose battery/export $ — fall back so the $ figure still loads.
      const savingsLogResult = firstSavingsResult.error
        ? await fetchSavingsLog(SAVINGS_CORE_COLUMNS)
        : firstSavingsResult;

      if (isImpersonating && savingsLogResult.error) {
        const savErr = savingsLogResult.error;
        throw Object.assign(savErr, {
          message: `daily_savings: ${savErr.message || "permission denied"}`,
        });
      }

      const readingsData = readingsResult.data ?? [];
      const savingsRows = savingsLogResult.error
        ? []
        : ((savingsLogResult.data ?? []) as unknown as SavingsLogRow[]);
      const yesterdayKey = getYesterdayBrisbaneDate();

      const loggedYesterday = savingsRows.find((r) => r.savings_date === yesterdayKey);
      const loggedCumulative = savingsRows.reduce(
        (sum, r) => sum + Number(r.savings_aud ?? 0),
        0,
      );

      // Server log only — never client dual-math (v1 formula ≠ savings_engine v2).
      // Unpriced (NSW volunteer) must not surface Ergon 12D even if stale daily_savings rows exist.
      const yesterdaySavings =
        dollarsPriced && loggedYesterday?.savings_aud != null
          ? Number(loggedYesterday.savings_aud)
          : null;
      const cumulativeSavings =
        dollarsPriced && savingsRows.length > 0
          ? Number(loggedCumulative.toFixed(2))
          : null;

      const latestRow =
        readingsData.length > 0 ? readingsData[readingsData.length - 1] : null;

      const hasLiveReadings = readingsData.length >= 2;
      const dayKeys = new Set(
        readingsData.map((r) => (r.timestamp || "").slice(0, 10)).filter(Boolean),
      );
      const daysOfData = dayKeys.size;

      const socRaw = latestRow?.battery_soc_percent;

      const snapshot: HouseholdSnapshot = {
        household_id: householdId,
        mode: "self_consume",
        reason: hasLiveReadings
          ? "Real data • Live readings from your system"
          : "Preparing your first readings — suggestions appear once live data arrives",
        battery_soc: optionalNumber(socRaw),
        solar_kw: latestRow?.solar_kw != null ? Number(latestRow.solar_kw) : 0,
        grid_kw: optionalNumber(latestRow?.grid_kw),
        consumption_kw:
          latestRow?.consumption_kw != null ? Number(latestRow.consumption_kw) : 0,
        yesterday_savings_aud: yesterdaySavings,
        yesterday_battery_discharge_aud:
          yesterdaySavings != null ? optionalNumber(loggedYesterday?.battery_discharge_aud) : null,
        yesterday_export_aud:
          yesterdaySavings != null ? optionalNumber(loggedYesterday?.export_aud) : null,
        cumulative_savings_aud: cumulativeSavings,
        last_updated: latestRow?.timestamp ?? new Date().toISOString(),
        data_source: hasLiveReadings ? "supabase" : "no_data",
        days_of_data: daysOfData,
        data_quality_note: hasLiveReadings
          ? !dollarsPriced
            ? "Live readings available — monitoring only (tariff not priced)"
            : loggedYesterday
              ? `Estimated from the daily savings log • Ergon 12D — not a retailer bill`
              : `Live readings available — estimated $ appears after the daily savings run`
          : "No live readings yet — your dashboard will fill in after the first successful data pull",
      };

      setData(snapshot);
    } catch (err) {
      console.error("useHouseholdSnapshot error:", err);
      const message = formatSnapshotFetchError(err);
      if (isImpersonating && isLikelyPermissionOrSchemaError(err)) {
        setData(buildEmptySnapshot(householdId));
        setError(new Error(message));
      } else if (isImpersonating) {
        setData(buildEmptySnapshot(householdId));
        setError(null);
      } else {
        setError(err instanceof Error ? err : new Error(message));
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (householdId) {
      fetchSnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId, isImpersonating, dollarsPriced]);

  return {
    data,
    loading,
    error,
    refetch: fetchSnapshot,
  };
}
