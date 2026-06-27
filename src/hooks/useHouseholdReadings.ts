import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface HouseholdReadingPoint {
  timestamp: string;
  solar_kw: number;
  consumption_kw: number;
  grid_kw: number;
  battery_power_kw: number;
}

interface UseHouseholdReadingsResult {
  data: HouseholdReadingPoint[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

const READINGS_LIMIT = 48;

export function useHouseholdReadings(householdId: string): UseHouseholdReadingsResult {
  const [data, setData] = useState<HouseholdReadingPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchReadings = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: rows, error: queryError } = await supabase
        .from("household_readings")
        .select("timestamp, solar_kw, consumption_kw, grid_kw, battery_power_kw")
        .eq("household_id", householdId)
        .order("timestamp", { ascending: false })
        .limit(READINGS_LIMIT);

      if (queryError) throw queryError;

      const points: HouseholdReadingPoint[] = (rows ?? [])
        .map((row: any) => ({
          timestamp: row.timestamp,
          solar_kw: Number(row.solar_kw) || 0,
          consumption_kw: Number(row.consumption_kw) || 0,
          grid_kw: Number(row.grid_kw) || 0,
          battery_power_kw: Number(row.battery_power_kw) || 0,
        }))
        .reverse();

      setData(points);
    } catch (err) {
      console.error("Readings error:", err);
      setError(err instanceof Error ? err : new Error("Failed to load readings"));
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (householdId) fetchReadings();
  }, [householdId]);

  return { data, loading, error, refetch: fetchReadings };
}