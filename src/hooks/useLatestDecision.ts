import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { AgentDecision } from "@/types/agentDecision";

interface UseLatestDecisionResult {
  data: AgentDecision | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useLatestDecision(householdId: string): UseLatestDecisionResult {
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
      setError(err instanceof Error ? err : new Error("Failed to load decision"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (householdId) fetchDecision();
  }, [householdId]);

  return { data, loading, error, refetch: fetchDecision };
}