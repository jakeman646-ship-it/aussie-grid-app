import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface HouseholdSnapshot {
  battery_soc: number;
  solar_kw: number;
  grid_kw: number;
  consumption_kw: number;
  yesterday_savings_aud?: number;
  cumulative_savings_aud?: number;
  last_updated: string;
  mode?: string;
  reason?: string;
  data_source?: string;
}

interface UseHouseholdSnapshotResult {
  data: HouseholdSnapshot | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useHouseholdSnapshot(householdId: string): UseHouseholdSnapshotResult {
  const [data, setData] = useState<HouseholdSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSnapshot = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: row, error: queryError } = await supabase
        .from("household_readings")
        .select("*")
        .eq("household_id", householdId)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      if (queryError) throw queryError;

      if (row) {
        const mapped: HouseholdSnapshot = {
          battery_soc: Number(row.battery_percent) || 0,
          solar_kw: Number(row.solar_kw) || 0,
          grid_kw: Number(row.grid_flow_kw) || 0,
          consumption_kw: Number(row.consumption_kw) || 0,
          last_updated: row.timestamp,
          mode: row.current_mode,
          reason: `Battery at ${row.battery_percent}% • ${row.grid_flow_label || "Grid normal"}`,
          data_source: "supabase",
        };
        setData(mapped);
      } else {
        setData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load snapshot"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (householdId) fetchSnapshot();
  }, [householdId]);

  return { data, loading, error, refetch: fetchSnapshot };
}