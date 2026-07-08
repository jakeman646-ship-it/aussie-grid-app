/**
 * Aussie Grid — useLatestDecision hook
 * File: src/hooks/useLatestDecision.ts
 * Version: v0.1.2.24
 * Lines: 88
 * Updated: 9 Jul 2026 — impersonation mode: missing decision is normal, not an error.
 */
import { useState, useEffect } from "react";
import { supabase, queryTimeout } from "@/lib/supabase";
import type { AgentDecision } from "@/types/agentDecision";

interface UseLatestDecisionOptions {
  /** When true, fetch failures are ignored — no agent decision yet is expected. */
  isImpersonating?: boolean;
}

interface UseLatestDecisionResult {
  data: AgentDecision | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useLatestDecision(
  householdId: string,
  options: UseLatestDecisionOptions = {},
): UseLatestDecisionResult {
  const { isImpersonating = false } = options;
  const [data, setData] = useState<AgentDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDecision = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: row, error: queryError } = await supabase
        .from("agent_decisions")
        .select("*")
        .eq("household_id", householdId)
        .order("timestamp", { ascending: false })
        .limit(1)
        .abortSignal(queryTimeout())
        .maybeSingle();

      if (queryError) throw queryError;

      if (row) {
        const mapped: AgentDecision = {
          mode: row.final_mode || row.proposed_mode || row.mode || "self_consume",
          reason: row.reason || "AI decision applied",
          confidence: row.confidence != null ? Number(row.confidence) : undefined,
          verification_passed: row.verification_passed ?? undefined,
          severity: row.severity ?? undefined,
          harmony_influenced: row.harmony_influenced ?? false,
          harmony_recommendation: row.harmony_recommendation ?? undefined,
          tomorrow_irradiance_kwh_m2: row.tomorrow_irradiance_kwh_m2 != null
            ? Number(row.tomorrow_irradiance_kwh_m2)
            : undefined,
          reasoning: {
            proposal: { mode: row.proposed_mode },
            final: { mode: row.final_mode },
            weather: {
              tomorrow_irradiance_kwh_m2: row.tomorrow_irradiance_kwh_m2 != null
                ? Number(row.tomorrow_irradiance_kwh_m2)
                : undefined,
              low_solar_forecast: row.low_solar_forecast ?? undefined,
            },
            context: {
              battery_soc: row.battery_soc != null ? Number(row.battery_soc) : undefined,
              solar_power_w: row.solar_power_w != null ? Number(row.solar_power_w) : undefined,
            },
          },
        };
        setData(mapped);
      } else {
        setData(null);
      }
    } catch (err) {
      // No agent decision yet is normal for new households during admin impersonation.
      if (isImpersonating) {
        setData(null);
        setError(null);
      } else {
        setError(err instanceof Error ? err : new Error("Failed to load decision"));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (householdId) fetchDecision();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId, isImpersonating]);

  return { data, loading, error, refetch: fetchDecision };
}