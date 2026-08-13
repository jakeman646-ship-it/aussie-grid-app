/**
 * Aussie Grid — Last N daily_savings rows (FE showcase readout)
 * File: src/hooks/useRecentDailySavings.ts
 * Version: v0.1.0
 * Updated: 13 Aug 2026 — sum Estimated $ from daily_savings; no agent weekly_readouts.
 */
import { useState, useEffect } from "react";
import { supabase, queryTimeout } from "@/lib/supabase";

export interface RecentDailySavingsSummary {
  dayCount: number;
  totalAud: number;
}

interface UseRecentDailySavingsResult {
  data: RecentDailySavingsSummary | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

const DAY_LIMIT = 7;

export function useRecentDailySavings(householdId: string): UseRecentDailySavingsResult {
  const [data, setData] = useState<RecentDailySavingsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRecent = async () => {
    const hid = (householdId || "").trim();
    if (!hid) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: rows, error: queryError } = await supabase
        .from("daily_savings")
        .select("savings_date, savings_aud")
        .eq("household_id", hid)
        .order("savings_date", { ascending: false })
        .limit(DAY_LIMIT)
        .abortSignal(queryTimeout());

      if (queryError) throw queryError;

      const list = rows ?? [];
      if (list.length === 0) {
        setData(null);
        return;
      }

      let total = 0;
      for (const row of list) {
        const v = row.savings_aud;
        if (v == null) continue;
        const n = Number(v);
        if (Number.isFinite(n)) total += n;
      }

      setData({
        dayCount: list.length,
        totalAud: Math.round(total * 100) / 100,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to load recent daily savings"),
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecent();
  }, [householdId]);

  return { data, loading, error, refetch: fetchRecent };
}
