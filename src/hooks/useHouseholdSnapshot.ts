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
        .select("timestamp, solar_kw, consumption_kw, grid_kw, battery_soc")
        .eq("household_id", householdId)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      if (queryError && queryError.code !== "PGRST116") {
        // PGRST116 = no rows found (not a real error for us)
        throw queryError;
      }

      if (row) {
        const mapped: HouseholdSnapshot = {
          battery_soc: Number(row.battery_soc) || 0,
          solar_kw: Number(row.solar_kw) || 0,
          grid_kw: Number(row.grid_kw) || 0,
          consumption_kw: Number(row.consumption_kw) || 0,
          last_updated: row.timestamp,
          mode: "self_consume", // placeholder until we have agent_decisions
          reason: "Based on current solar, battery and grid conditions",
          data_source: "supabase",
        };
        setData(mapped);
      } else {
        setData(null);
      }
    } catch (err) {
      console.error("Snapshot error:", err);
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