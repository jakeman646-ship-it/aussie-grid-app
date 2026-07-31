/**
 * Aussie Grid — useSigenergyStatus
 * File: src/hooks/useSigenergyStatus.ts
 * Version: v0.2.1
 * Updated: 1 Aug 2026 — drop ungranted sigenergy_system_id from pilot_households select
 *
 * Best-effort Sigenergy ingest visibility for the household dashboard.
 * Soft-fails to placeholder "not_configured" / "data_not_ready" — never invents connected.
 */
import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured, queryTimeout, supabase } from "@/lib/supabase";
import type { EnergySystemConnectionStatus } from "@/types/energySystemStatus";

/** @deprecated Prefer EnergySystemConnectionStatus — kept as Sigenergy alias. */
export type SigenergyUiStatus = EnergySystemConnectionStatus;

/** Compact day totals from the latest successful daily_system_summary pull. */
export interface SigenergyLastIngest {
  summaryDate: string | null;
  updatedAt: string | null;
  solarKwh: number | null;
  importKwh: number | null;
  exportKwh: number | null;
  selfConsumptionKwh: number | null;
  batterySocEnd: number | null;
  source: string | null;
}

export interface SigenergyStatusView {
  status: EnergySystemConnectionStatus;
  lastSuccessAt: string | null;
  systemId: string | null;
  siteType: string | null;
  phaseDataPresent: boolean;
  usingPlaceholder: boolean;
  /** Latest usable day totals when a summary row exists (read-only). */
  lastIngest: SigenergyLastIngest | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface SummaryRow {
  household_id: string;
  date: string | null;
  source: string | null;
  system_id: string | null;
  pv_energy_kwh: number | null;
  grid_import_kwh: number | null;
  grid_export_kwh: number | null;
  self_consumption_kwh: number | null;
  battery_soc_end: number | null;
  data_quality: string | null;
  raw_meta: unknown;
  updated_at: string | null;
}

const SUMMARY_SELECT =
  "household_id, date, source, system_id, pv_energy_kwh, grid_import_kwh, grid_export_kwh, self_consumption_kwh, battery_soc_end, data_quality, raw_meta, updated_at";

function parseMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return {};
}

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toLastIngest(summary: SummaryRow | null): SigenergyLastIngest | null {
  if (!summary) return null;
  const meta = parseMeta(summary.raw_meta);
  const solar = asNum(summary.pv_energy_kwh) ?? asNum(meta.solar_kwh);
  const imp = asNum(summary.grid_import_kwh) ?? asNum(meta.import_kwh);
  const exp = asNum(summary.grid_export_kwh) ?? asNum(meta.export_kwh);
  const selfKwh =
    asNum(summary.self_consumption_kwh) ?? asNum(meta.self_consumption_kwh);
  const soc = asNum(summary.battery_soc_end) ?? asNum(meta.soc_end_pct);

  const hasAny =
    solar != null || imp != null || exp != null || selfKwh != null || soc != null;
  if (!hasAny) return null;

  return {
    summaryDate: summary.date,
    updatedAt: summary.updated_at,
    solarKwh: solar,
    importKwh: imp,
    exportKwh: exp,
    selfConsumptionKwh: selfKwh,
    batterySocEnd: soc,
    source: summary.source,
  };
}

export function useSigenergyStatus(householdId: string): SigenergyStatusView {
  const [status, setStatus] = useState<EnergySystemConnectionStatus>("not_configured");
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [systemId, setSystemId] = useState<string | null>(null);
  const [siteType, setSiteType] = useState<string | null>(null);
  const [phaseDataPresent, setPhaseDataPresent] = useState(false);
  const [usingPlaceholder, setUsingPlaceholder] = useState(true);
  const [lastIngest, setLastIngest] = useState<SigenergyLastIngest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      if (!householdId || !isSupabaseConfigured) {
        if (!cancelled) {
          setStatus("not_configured");
          setUsingPlaceholder(true);
          setLastIngest(null);
          setLoading(false);
        }
        return;
      }

      try {
        let sid: string | null = null;
        let make: string | null = null;

        // Safe columns only (harden_connection_rls GRANT) — never select ungranted cols
        // like sigenergy_system_id (PostgREST 403). Soft-fail if row missing.
        try {
          const { data: hh } = await supabase
            .from("pilot_households")
            .select("inverter_make, inverter_serial")
            .eq("household_id", householdId)
            .abortSignal(queryTimeout())
            .maybeSingle();
          if (hh) {
            make = (hh.inverter_make as string | null) || null;
            // Sigenergy system id not granted to anon/authenticated — use serial when make is Sigenergy.
            sid =
              make && make.toLowerCase().includes("sigenergy")
                ? ((hh.inverter_serial as string | null) || "").trim() || null
                : null;
          }
        } catch {
          /* registry read may fail under RLS — leave not_configured */
        }

        let summary: SummaryRow | null = null;
        try {
          const { data: rows, error: sumErr } = await supabase
            .from("daily_system_summary")
            .select(SUMMARY_SELECT)
            .eq("household_id", householdId)
            .eq("source", "sigenergy_cloud")
            .order("updated_at", { ascending: false })
            .limit(1)
            .abortSignal(queryTimeout())
            .returns<SummaryRow[]>();
          if (sumErr) throw sumErr;
          summary = rows?.[0] ?? null;
        } catch {
          // Try without source filter (older schema / narrower columns).
          try {
            const { data: rows } = await supabase
              .from("daily_system_summary")
              .select(
                "household_id, date, source, system_id, pv_energy_kwh, battery_soc_end, data_quality, raw_meta, updated_at",
              )
              .eq("household_id", householdId)
              .order("updated_at", { ascending: false })
              .limit(1)
              .abortSignal(queryTimeout())
              .returns<SummaryRow[]>();
            const candidate = rows?.[0];
            if (
              candidate &&
              (candidate.source === "sigenergy_cloud" ||
                (make && make.toLowerCase().includes("sigenergy")))
            ) {
              summary = candidate;
            }
          } catch {
            /* no summary access */
          }
        }

        if (cancelled) return;

        const meta = parseMeta(summary?.raw_meta);
        const phasePresent = Boolean(meta.phase_data_present) || Number(meta.phase_count || 0) > 0;
        const resolvedSid = (summary?.system_id || sid || "").trim() || null;
        const resolvedSite =
          typeof meta.site_type === "string"
            ? meta.site_type
            : make?.toLowerCase().includes("sigenergy")
              ? "unknown"
              : null;

        setSystemId(resolvedSid);
        setSiteType(resolvedSite);
        setPhaseDataPresent(phasePresent);
        setLastIngest(toLastIngest(summary));

        const hasEnergy =
          summary != null &&
          (summary.pv_energy_kwh != null || summary.battery_soc_end != null);

        if (hasEnergy && summary) {
          setStatus("connected");
          setLastSuccessAt(summary.updated_at);
          setUsingPlaceholder(false);
        } else if (resolvedSid || (make && make.toLowerCase().includes("sigenergy"))) {
          setStatus("data_not_ready");
          setLastSuccessAt(summary?.updated_at ?? null);
          setUsingPlaceholder(!summary);
        } else {
          setStatus("not_configured");
          setLastSuccessAt(null);
          setUsingPlaceholder(true);
          setLastIngest(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Status lookup failed");
          setStatus("not_configured");
          setUsingPlaceholder(true);
          setLastIngest(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [householdId, tick]);

  return {
    status,
    lastSuccessAt,
    systemId,
    siteType,
    phaseDataPresent,
    usingPlaceholder,
    lastIngest,
    loading,
    error,
    refetch,
  };
}
