/**
 * Aussie Grid — usePilotHousehold hook
 * File: src/hooks/usePilotHousehold.ts
 * Version: v0.1.2.25
 * Updated: 28 Aug 2026 — state/dnsp/profile for priced-$ gate (fail-open if columns blocked).
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
}

export function formatPhaseCountLabel(phaseCount: number | null | undefined): string | null {
  if (phaseCount === 1) return "Single Phase";
  if (phaseCount === 3) return "3 Phase";
  return null;
}

const SELECT_WITH_LOCATION =
  "household_id, email, status, inverter_make, battery_capacity_kwh, solar_kw, phase_count, consent_given, is_test, sungrow_plant_id, sungrow_connected_at, inverter_serial, tesla_site_id, tesla_connected_at, agent_control_mode, agent_control_activated_at, community_id, state, dnsp, network_tariff_profile";

const SELECT_CORE =
  "household_id, email, status, inverter_make, battery_capacity_kwh, solar_kw, phase_count, consent_given, is_test, sungrow_plant_id, sungrow_connected_at, inverter_serial, tesla_site_id, tesla_connected_at, agent_control_mode, agent_control_activated_at, community_id";

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
  const { isImpersonating = false } = options;
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
        .select(SELECT_WITH_LOCATION)
        .eq("household_id", householdId)
        .abortSignal(queryTimeout())
        .maybeSingle();
      let queryError = first.error;
      row = (first.data as PilotHousehold | null) ?? null;

      if (queryError && isMissingColumnError(queryError)) {
        const retry = await supabase
          .from("pilot_households")
          .select(SELECT_CORE)
          .eq("household_id", householdId)
          .abortSignal(queryTimeout())
          .maybeSingle();
        const retryRow = retry.data as PilotHousehold | null;
        row = retryRow
          ? {
              ...retryRow,
              state: null,
              dnsp: null,
              network_tariff_profile: null,
            }
          : null;
        queryError = retry.error;
      }

      if (queryError) throw queryError;

      if (!row) {
        // Admin impersonating a brand-new household: no registry row yet is expected.
        if (isImpersonating) {
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
      setError(err instanceof Error ? err : new Error("Failed to load household"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (householdId) fetchHousehold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId, isImpersonating]);

  return { data, loading, error, refetch: fetchHousehold };
}
