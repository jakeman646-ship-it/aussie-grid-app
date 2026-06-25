import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface LatestDecision {
  mode: string;
  reason: string;
  reasoning?: {
    proposal?: { mode: string };
    final?: { mode: string };
    weather?: { tomorrow_irradiance_kwh_m2?: number; low_solar_forecast?: boolean };
  };
  harmony_influenced?: boolean;
  tomorrow_irradiance_kwh_m2?: number;
}

interface UseLatestDecisionResult {
  data: LatestDecision | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useLatestDecision(householdId: string): UseLatestDecisionResult {
  const [data, setData] = useState<LatestDecision | null>(null);
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
        .single();

      if (queryError) throw queryError;

      if (row) {
        const mapped: LatestDecision = {
          mode: row.final_mode || row.proposed_mode,
          reason: row.reason || "AI decision applied",
          reasoning: {
            proposal: { mode: row.proposed_mode },
            final: { mode: row.final_mode },
            weather: {
              tomorrow_irradiance_kwh_m2: 5.2,
              low_solar_forecast: false,
            },
          },
          harmony_influenced: false,
          tomorrow_irradiance_kwh_m2: 5.2,
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