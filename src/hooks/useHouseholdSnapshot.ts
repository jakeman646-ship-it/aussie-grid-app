/**
 * Aussie Grid — Hooks
 * File: src/hooks/useHouseholdSnapshot.ts
 * Version: v0.1.2.24
 * Lines: 175
 * Updated: 9 Jul 2026 — impersonation mode: fetch failures degrade to empty snapshot, not errors.
 */
import { useState, useEffect } from "react";
import { supabase, queryTimeout } from "@/lib/supabase";
import {
  calculateSavingsFromReadings,
  getYesterdayBrisbaneDate,
  type Reading,
} from "@/lib/calculateSavings";

export interface HouseholdSnapshot {
  household_id: string;
  mode: string;
  reason: string;
  battery_soc: number;
  solar_kw: number;
  grid_kw: number;
  consumption_kw: number;
  yesterday_savings_aud: number | null;
  cumulative_savings_aud: number | null;
  last_updated: string;
  data_source: string;
  days_of_data: number;
  data_quality_note: string;
}

interface UseHouseholdSnapshotOptions {
  /** When true, query failures return an empty snapshot instead of blocking the dashboard. */
  isImpersonating?: boolean;
}

interface UseHouseholdSnapshotResult {
  data: HouseholdSnapshot | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/** Minimal snapshot for admin impersonation before telemetry exists. */
function buildEmptySnapshot(householdId: string): HouseholdSnapshot {
  return {
    household_id: householdId,
    mode: "self_consume",
    reason: "Waiting for first telemetry readings",
    battery_soc: 0,
    solar_kw: 0,
    grid_kw: 0,
    consumption_kw: 0,
    yesterday_savings_aud: null,
    cumulative_savings_aud: null,
    last_updated: new Date().toISOString(),
    data_source: "no_data",
    days_of_data: 0,
    data_quality_note: "No readings yet — connect the inverter to start collecting data",
  };
}

export function useHouseholdSnapshot(
  householdId: string,
  options: UseHouseholdSnapshotOptions = {},
): UseHouseholdSnapshotResult {
  const { isImpersonating = false } = options;
  const [data, setData] = useState<HouseholdSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSnapshot = async () => {
    setLoading(true);
    setError(null);

    try {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

      const [readingsResult, savingsLogResult] = await Promise.all([
        supabase
          .from("household_readings")
          .select("timestamp, consumption_kw, grid_kw, solar_kw, battery_power_kw, battery_soc")
          .eq("household_id", householdId)
          .gte("timestamp", since)
          .order("timestamp", { ascending: true })
          .abortSignal(queryTimeout()),
        supabase
          .from("daily_savings")
          .select("savings_date, savings_aud")
          .eq("household_id", householdId)
          .gte("savings_date", since.split("T")[0])
          .order("savings_date", { ascending: false })
          .abortSignal(queryTimeout()),
      ]);

      if (readingsResult.error) throw readingsResult.error;

      const readingsData = readingsResult.data ?? [];
      const readings: Reading[] = readingsData.map((r) => ({
        timestamp: r.timestamp,
        consumption_kw: Number(r.consumption_kw ?? 0),
        grid_kw: Number(r.grid_kw ?? 0),
        solar_kw: r.solar_kw != null ? Number(r.solar_kw) : undefined,
        battery_power_kw: r.battery_power_kw != null ? Number(r.battery_power_kw) : undefined,
      }));

      const calc = calculateSavingsFromReadings(readings);
      const savingsRows = savingsLogResult.data ?? [];
      const yesterdayKey = getYesterdayBrisbaneDate();

      const loggedYesterday = savingsRows.find((r) => r.savings_date === yesterdayKey);
      const loggedCumulative = savingsRows.reduce(
        (sum, r) => sum + Number(r.savings_aud ?? 0),
        0
      );

      const yesterdaySavings =
        loggedYesterday?.savings_aud != null
          ? Number(loggedYesterday.savings_aud)
          : calc.yesterdaySavings > 0
            ? calc.yesterdaySavings
            : null;

      const cumulativeSavings =
        loggedCumulative > 0
          ? Number(loggedCumulative.toFixed(2))
          : calc.cumulativeSavings > 0
            ? calc.cumulativeSavings
            : null;

      const latestRow =
        readingsData.length > 0 ? readingsData[readingsData.length - 1] : null;
      const latest = readings.length > 0 ? readings[readings.length - 1] : null;

      const hasLiveReadings = readings.length >= 2;
      const savingsSource = loggedYesterday ? "daily_savings log" : "live readings";

      const snapshot: HouseholdSnapshot = {
        household_id: householdId,
        mode: "self_consume",
        reason: hasLiveReadings
          ? "Real data • Calculated from your actual solar, grid & consumption"
          : "Waiting for first telemetry readings",
        battery_soc: latestRow?.battery_soc != null ? Number(latestRow.battery_soc) : 0,
        solar_kw: latest?.solar_kw ?? 0,
        grid_kw: latest?.grid_kw ?? 0,
        consumption_kw: latest?.consumption_kw ?? 0,
        yesterday_savings_aud: yesterdaySavings,
        cumulative_savings_aud: cumulativeSavings,
        last_updated: latestRow?.timestamp ?? new Date().toISOString(),
        data_source: hasLiveReadings ? "supabase" : "no_data",
        days_of_data: calc.daysOfData || 0,
        data_quality_note: hasLiveReadings
          ? `${calc.dataNote} • Ergon 12D TOU via ${savingsSource}`
          : "Connect your system to start collecting readings",
      };

      setData(snapshot);
    } catch (err) {
      console.error("useHouseholdSnapshot error:", err);
      // During admin impersonation, a failed snapshot fetch should not look like a broken dashboard.
      if (isImpersonating) {
        setData(buildEmptySnapshot(householdId));
        setError(null);
      } else {
        setError(err instanceof Error ? err : new Error("Failed to load household snapshot"));
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
  }, [householdId, isImpersonating]);

  return {
    data,
    loading,
    error,
    refetch: fetchSnapshot,
  };
}
