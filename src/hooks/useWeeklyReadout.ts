import { useState, useEffect } from "react";
import { supabase, queryTimeout } from "../lib/supabase";
import type { WeeklyReadout } from "@/types/pilotConfig";

interface UseWeeklyReadoutResult {
  data: WeeklyReadout | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useWeeklyReadout(householdId: string): UseWeeklyReadoutResult {
  const [data, setData] = useState<WeeklyReadout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchReadout = async () => {
    if (!householdId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: row, error: queryError } = await supabase
        .from("weekly_readouts")
        .select("*")
        .eq("household_id", householdId)
        .order("week_start", { ascending: false })
        .limit(1)
        .abortSignal(queryTimeout())
        .maybeSingle();

      if (queryError) throw queryError;
      setData(row as WeeklyReadout | null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load weekly readout"));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadout();
  }, [householdId]);

  return { data, loading, error, refetch: fetchReadout };
}
