/**
 * Aussie Grid — Hooks
 * File: src/hooks/useHouseholdReadings.ts
 * Version: v0.1.2.17
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, queryTimeout } from "@/lib/supabase";

export interface HouseholdReading {
  timestamp: string;
  solar_kw?: number;
  consumption_kw?: number;
  grid_kw?: number;
  battery_power_kw?: number;
}

export function useHouseholdReadings(householdId: string | null, limit = 80) {
  const [readings, setReadings] = useState<HouseholdReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReadings = useCallback(async () => {
    if (!householdId) {
      setReadings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("household_readings")
      .select("timestamp, solar_kw, consumption_kw, grid_kw, battery_power_kw")
      .eq("household_id", householdId)
      .order("timestamp", { ascending: false })
      .abortSignal(queryTimeout())
      .limit(limit);

    if (error) {
      console.error("useHouseholdReadings error:", error);
      setError(error.message);
      setReadings([]);
    } else {
      setReadings((data || []).reverse());
    }
    setLoading(false);
  }, [householdId, limit]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  return { readings, loading, error, refetch: fetchReadings };
}