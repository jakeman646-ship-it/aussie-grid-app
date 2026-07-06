import { useState, useEffect } from "react";
import { supabase, queryTimeout } from "../lib/supabase";
import type { PilotPhase } from "@/types/pilotConfig";

interface UsePilotPhaseResult {
  phase: PilotPhase;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePilotPhase(): UsePilotPhaseResult {
  const [phase, setPhase] = useState<PilotPhase>("pre_pilot");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPhase = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from("pilot_config")
        .select("pilot_phase")
        .eq("config_key", "mackay-pilot-01")
        .abortSignal(queryTimeout())
        .maybeSingle();

      if (queryError) throw queryError;
      const raw = data?.pilot_phase;
      setPhase(raw === "active" ? "active" : "pre_pilot");
    } catch (err) {
      setPhase("pre_pilot");
      setError(err instanceof Error ? err : new Error("Failed to load pilot phase"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhase();
  }, []);

  return { phase, loading, error, refetch: fetchPhase };
}
