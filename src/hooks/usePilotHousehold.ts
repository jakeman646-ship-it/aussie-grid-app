/**
 * Aussie Grid — usePilotHousehold hook
 * File: src/hooks/usePilotHousehold.ts
 * Version: v0.1.2.26
 * Updated: 28 Aug 2026 — optional retail_* for Profile rates (fail-open if columns blocked).
 */
import { useState, useEffect } from "react";
import { isSupabaseNoRowsError } from "@/lib/impersonationDataStatus";
import { supabase, queryTimeout } from "../lib/supabase";

/** RLS-safe columns returned by usePilotHousehold (no passwords/tokens/keys). */
export interface PilotHousehold {
  household_id: string;
  email: string | null;
  status: string;
  inverter_make: string | null;
  battery_capacity_kwh: number | null;
  solar_kw: number | null;
  phase_count: number | null;
  consent_given: boolean;
  is_test: boolean;
  sungrow_plant_id: string | null;
  sungrow_connected_at: string | null;
  inverter_serial: string | null;
  tesla_site_id: string | null;
  tesla_connected_at: string | null;
  /** read_only = suggest only; agent_control = agent applies modes */
  agent_control_mode: "read_only" | "agent_control" | null;
  agent_control_activated_at: string | null;
  community_id: string | null;
  state: string | null;
  dnsp: string | null;
  network_tariff_profile: string | null;
  retail_plan_id: string | null;
  retail_peak_rate: number | null;
  retail_shoulder_rate: number | null;
  retail_off_peak_rate: number | null;
  retail_fit_rate: number | null;
}

export function formatPhaseCountLabel(phaseCount: number | null | undefined): string | null {
  if (phaseCount === 1) return "Single Phase";
  if (phaseCount === 3) return "3 Phase";
  return null;
}

const SELECT_CORE =
  "household_id, email, status, inverter_make, battery_capacity_kwh, solar_kw, phase_count, consent_given, is_test, sungrow_plant_id, sungrow_connected_at, inverter_serial, tesla_site_id, tesla_connected_at, agent_control_mode, agent_control_activated_at, community_id";

const SELECT_WITH_LOCATION = `${SELECT_CORE}, state, dnsp, network_tariff_profile`;

const SELECT_WITH_RETAIL = `${SELECT_WITH_LOCATION}, retail_plan_id, retail_peak_rate, retail_shoulder_rate, retail_off_peak_rate, retail_fit_rate`;

const EMPTY_LOCATION = {
  state: null as string | null,
  dnsp: null as string | null,
  network_tariff_profile: null as string | null,
};

const EMPTY_RETAIL = {
  retail_plan_id: null as string | null,
  retail_peak_rate: null as number | null,
  retail_shoulder_rate: null as number | null,
  retail_off_peak_rate: null as number | null,
  retail_fit_rate: null as number | null,
};

function withMissingFields(
  row: Record<string, unknown> | null,
  extras: Record<string, unknown>
): PilotHousehold | null {
  if (!row) return null;
  return { ...EMPTY_LOCATION, ...EMPTY_RETAIL, ...row, ...extras } as PilotHousehold;
}

function isMissingColumnError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const msg = (e.message ?? "").toLowerCase();
  const code = String(e.code ?? "");
  return (
    code === "PGRST204" ||
    /column .* does not exist|could not find.*column|schema cache/i.test(msg)
  );
}

export interface UsePilotHouseholdOptions {
  /** When true, a missing pilot_households row is treated as "no data yet" (admin impersonation). */
  isImpersonating?: boolean;
  /** When true, a missing row is data=null (not an error) — Profile rates before Connect. */
  allowMissing?: boolean;
}

interface UsePilotHouseholdResult {
  data: PilotHousehold | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePilotHousehold(
  householdId: string,
  options: UsePilotHouseholdOptions = {},
): UsePilotHouseholdResult {
  const { isImpersonating = false, allowMissing = false } = options;
  const [data, setData] = useState<PilotHousehold | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHousehold = async () => {
    setLoading(true);
    setError(null);

    try {
      // Explicit safe columns only — select("*") fails after harden_connection_rls.sql v1.1
      // (passwords/tokens/keys are not granted to anon/authenticated).
      let row: PilotHousehold | null = null;
      const first = await supabase
        .from("pilot_households")
        .select(SELECT_WITH_RETAIL)
        .eq("household_id", householdId)
        .abortSignal(queryTimeout())
        .maybeSingle();
      let queryError = first.error;
      row = withMissingFields(first.data as Record<string, unknown> | null, {});

      if (queryError && isMissingColumnError(queryError)) {
        const retryLocation = await supabase
          .from("pilot_households")
          .select(SELECT_WITH_LOCATION)
          .eq("household_id", householdId)
          .abortSignal(queryTimeout())
          .maybeSingle();
        queryError = retryLocation.error;
        row = withMissingFields(retryLocation.data as Record<string, unknown> | null, {
          ...EMPTY_RETAIL,
        });
      }

      if (queryError && isMissingColumnError(queryError)) {
        const retry = await supabase
          .from("pilot_households")
          .select(SELECT_CORE)
          .eq("household_id", householdId)
          .abortSignal(queryTimeout())
          .maybeSingle();
        queryError = retry.error;
        row = withMissingFields(retry.data as Record<string, unknown> | null, {
          ...EMPTY_LOCATION,
          ...EMPTY_RETAIL,
        });
      }

      if (queryError) throw queryError;

      if (!row) {
        // Admin impersonating, or Profile before a household row exists.
        if (isImpersonating || allowMissing) {
          setData(null);
          setError(null);
          return;
        }
        throw new Error("Failed to load household");
      }

      setData(row);
    } catch (err) {
      // During impersonation, "no rows" from Supabase is not surfaced as a hard error.
      if (isImpersonating && isSupabaseNoRowsError(err)) {
        setData(null);
        setError(null);
        return;
      }
      if (allowMissing && isSupabaseNoRowsError(err)) {
        setData(null);
        setError(null);
        return;
      }
      setError(err instanceof Error ? err : new Error("Failed to load household"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!householdId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    fetchHousehold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId, isImpersonating, allowMissing]);

  return { data, loading, error, refetch: fetchHousehold };
}
