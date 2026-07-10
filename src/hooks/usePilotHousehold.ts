/**
 * Aussie Grid — usePilotHousehold hook
 * File: src/hooks/usePilotHousehold.ts
 * Version: v0.1.2.24
 * Lines: 98
 * Updated: 9 Jul 2026 — impersonation mode: missing registry row is empty state, not an error.
 */
import { useState, useEffect } from "react";
import { isSupabaseNoRowsError } from "@/lib/impersonationDataStatus";
import { supabase, queryTimeout } from "../lib/supabase";

export interface PilotHousehold {
  household_id: string;
  user_id?: string;
  email?: string;
  status: string;
  inverter_make: string | null;
  battery_capacity_kwh: number | null;
  solar_kw: number | null;
  phase_count?: number | null;
  consent_given: boolean;
  is_test: boolean;
  onboarding_notes?: string | null;
  community_id?: string | null;
  // Sungrow connection fields (keys/tokens are not selected — RLS-safe columns only)
  sungrow_app_key?: string | null;
  sungrow_access_key?: string | null;
  sungrow_plant_id?: string | null;
  sungrow_connected_at?: string | null;
  inverter_serial?: string | null;
  // Tesla connection fields (password/email secrets are not selected)
  tesla_site_id?: string | null;
  tesla_connected_at?: string | null;
  tesla_account_email?: string | null;
  /** read_only = suggest only; agent_control = agent applies modes */
  agent_control_mode?: "read_only" | "agent_control";
  agent_control_activated_at?: string | null;
}

export function formatPhaseCountLabel(phaseCount: number | null | undefined): string | null {
  if (phaseCount === 1) return "Single Phase";
  if (phaseCount === 3) return "3 Phase";
  return null;
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
      const { data: row, error: queryError } = await supabase
        .from("pilot_households")
        .select(
          [
            "household_id",
            "email",
            "status",
            "inverter_make",
            "battery_capacity_kwh",
            "solar_kw",
            "phase_count",
            "consent_given",
            "is_test",
            "sungrow_plant_id",
            "sungrow_connected_at",
            "inverter_serial",
            "tesla_site_id",
            "tesla_connected_at",
            "agent_control_mode",
            "agent_control_activated_at",
            "community_id",
          ].join(", ")
        )
        .eq("household_id", householdId)
        .abortSignal(queryTimeout())
        .maybeSingle();

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

      setData(row as PilotHousehold);
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
