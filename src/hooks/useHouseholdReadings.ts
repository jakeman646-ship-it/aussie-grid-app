import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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

  useEffect(() => {
    if (!householdId) {
      setReadings([]);
      setLoading(false);
      return;
    }

    const fetchReadings = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("household_readings")
        .select("timestamp, solar_kw, consumption_kw, grid_kw, battery_power_kw")
        .eq("household_id", householdId)
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("useHouseholdReadings error:", error);
        setError(error.message);
        setReadings([]);
      } else {
        // Reverse so oldest → newest for the chart
        setReadings((data || []).reverse());
      }
      setLoading(false);
    };

    fetchReadings();
  }, [householdId, limit]);

  return { readings, loading, error };
}