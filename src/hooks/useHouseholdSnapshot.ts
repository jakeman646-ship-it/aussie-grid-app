/**
 * Aussie Grid — Hooks
 * File: src/hooks/useHouseholdSnapshot.ts
 * Version: v0.1.2.7
 */
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  calculateSavingsFromReadings,
  type Reading,
} from "@/lib/calculateSavings";

export interface HouseholdSnapshot {
  household_id: string;
  mode: string;
  reason: string;
  battery_soc: number;
  solar_kw: number;
  grid_kw: number;
  consumption_kw: number;
  yesterday_savings_aud: number | null;
  cumulative_savings_aud: number | null;
  last_updated: string;
  data_source: string;
  days_of_data: number;
  data_quality_note: string;
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
      const { data: readingsData, error: readingsError } = await supabase
        .from("household_readings")
        .select("timestamp, consumption_kw, grid_kw, solar_kw, battery_power_kw, battery_soc")
        .eq("household_id", householdId)
        .gte("timestamp", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order("timestamp", { ascending: true });

      if (readingsError) throw readingsError;

      const readings: Reading[] = (readingsData || []).map((r) => ({
        timestamp: r.timestamp,
        consumption_kw: Number(r.consumption_kw ?? 0),
        grid_kw: Number(r.grid_kw ?? 0),
        solar_kw: r.solar_kw != null ? Number(r.solar_kw) : undefined,
        battery_power_kw: r.battery_power_kw != null ? Number(r.battery_power_kw) : undefined,
      }));

      const savings = calculateSavingsFromReadings(readings);
      const latestRow = readingsData && readingsData.length > 0
        ? readingsData[readingsData.length - 1]
        : null;
      const latest = readings.length > 0 ? readings[readings.length - 1] : null;

      const snapshot: HouseholdSnapshot = {
        household_id: householdId,
        mode: "self_consume",
        reason: readings.length > 0
          ? "Real data • Calculated from your actual solar, grid & consumption"
          : "Waiting for first telemetry readings",
        battery_soc: latestRow?.battery_soc != null ? Number(latestRow.battery_soc) : 0,
        solar_kw: latest?.solar_kw ?? 0,
        grid_kw: latest?.grid_kw ?? 0,
        consumption_kw: latest?.consumption_kw ?? 0,
        yesterday_savings_aud: savings.yesterdaySavings || null,
        cumulative_savings_aud: savings.pilotProjectedTotal || null,
        last_updated: latestRow?.timestamp ?? new Date().toISOString(),
        data_source: readings.length > 0 ? "supabase" : "no_data",
        days_of_data: savings.daysOfData || 0,
        data_quality_note: savings.dataNote || "Based on available data",
      };

      setData(snapshot);
    } catch (err) {
      console.error("useHouseholdSnapshot error:", err);
      setError(err instanceof Error ? err : new Error("Failed to load household snapshot"));

      setData({
        household_id: householdId,
        mode: "self_consume",
        reason: "Using demo data (real readings not yet available)",
        battery_soc: 87,
        solar_kw: 4.2,
        grid_kw: -1.8,
        consumption_kw: 2.4,
        yesterday_savings_aud: 3.42,
        cumulative_savings_aud: 47.9,
        last_updated: new Date().toISOString(),
        data_source: "simulated",
        days_of_data: 1,
        data_quality_note: "Based on 1 complete day of data",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (householdId) {
      fetchSnapshot();
    }
  }, [householdId]);

  return {
    data,
    loading,
    error,
    refetch: fetchSnapshot,
  };
}