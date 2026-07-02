import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface PilotHousehold {
  household_id: string;
  user_id?: string;
  email?: string;
  status: string;
  inverter_make: string | null;
  battery_capacity_kwh: number | null;
  solar_kw: number | null;
  consent_given: boolean;
  is_test: boolean;
  onboarding_notes?: string | null;
  // Sungrow connection fields
  sungrow_app_key?: string | null;
  sungrow_access_key?: string | null;
  sungrow_connected_at?: string | null;
}

interface UsePilotHouseholdResult {
  data: PilotHousehold | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePilotHousehold(householdId: string): UsePilotHouseholdResult {
  const [data, setData] = useState<PilotHousehold | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHousehold = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: row, error: queryError } = await supabase
        .from("pilot_households")
        .select("*")
        .eq("household_id", householdId)
        .single();

      if (queryError) throw queryError;
      setData(row as PilotHousehold);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load household"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (householdId) fetchHousehold();
  }, [householdId]);

  return { data, loading, error, refetch: fetchHousehold };
}