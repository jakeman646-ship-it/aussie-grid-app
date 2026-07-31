/**
 * Aussie Grid — latest household_readings.timestamp (limit 1)
 * File: src/hooks/useLatestReadingAt.ts
 * Version: v0.1.0
 * Updated: 1 Aug 2026
 *
 * Small read-only helper for Connection Health / Sungrow monitoring honesty.
 * Prefer passing snapshot.last_updated from Dashboard when live; this is fallback.
 */
import { useEffect, useState } from "react";
import { supabase, queryTimeout } from "@/lib/supabase";

export function useLatestReadingAt(
  householdId: string | null | undefined,
  /** When parent already has a real reading time, skip the query. */
  preferredAt?: string | null,
): { lastReadingAt: string | null; loading: boolean } {
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (preferredAt) {
      setFetchedAt(null);
      setLoading(false);
      return;
    }
    const hid = (householdId || "").trim();
    if (!hid) {
      setFetchedAt(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("household_readings")
          .select("timestamp")
          .eq("household_id", hid)
          .order("timestamp", { ascending: false })
          .limit(1)
          .abortSignal(queryTimeout());

        if (cancelled) return;
        if (error) {
          setFetchedAt(null);
          return;
        }
        const ts = data?.[0]?.timestamp;
        setFetchedAt(typeof ts === "string" ? ts : null);
      } catch {
        if (!cancelled) setFetchedAt(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [householdId, preferredAt]);

  return {
    lastReadingAt: preferredAt || fetchedAt,
    loading: preferredAt ? false : loading,
  };
}
