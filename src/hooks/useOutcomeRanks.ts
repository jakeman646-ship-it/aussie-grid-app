/**
 * Aussie Grid - useOutcomeRanks hook
 * File: src/hooks/useOutcomeRanks.ts
 * Version: v0.1.2
 * Updated: 21 Jul 2026 - P0 editable ranks; notify Dashboard after save.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, queryTimeout } from "@/lib/supabase";
import {
  coerceRanks,
  DEFAULT_OUTCOME_RANKS,
  ranksFromOrderedKeys,
  sortKeysByRank,
  validateRanks,
} from "@/lib/outcomeRanks";
import type {
  HouseholdOutcomeRanksRow,
  OutcomeKey,
  OutcomeRanks,
} from "@/types/outcomeRanks";

/** Fired after a successful user save so other mounted views (Dashboard) refetch. */
export const OUTCOME_RANKS_UPDATED_EVENT = "aussie-grid:outcome-ranks-updated";

interface UseOutcomeRanksOptions {
  /** When true, ranks are view-only (no save). */
  isImpersonating?: boolean;
}

interface UseOutcomeRanksResult {
  /** Current ranks (DB row or pilot defaults - no inventing a DB row until save). */
  ranks: OutcomeRanks;
  /** Keys ordered most -> least important. */
  orderedKeys: OutcomeKey[];
  /** True when a current DB row exists (effective_to IS NULL). */
  hasSavedRow: boolean;
  loading: boolean;
  saving: boolean;
  error: Error | null;
  saveError: string | null;
  saveSuccess: string | null;
  /** Impersonation or missing household - no writes. */
  isReadOnly: boolean;
  refetch: () => Promise<void>;
  /**
   * Close previous current row (effective_to = now) and insert new source=user.
   * Soft-seeds on first save only - does not invent rows on load.
   */
  saveOrderedKeys: (ordered: OutcomeKey[]) => Promise<boolean>;
  clearSaveFeedback: () => void;
}

export function useOutcomeRanks(
  householdId: string,
  options: UseOutcomeRanksOptions = {},
): UseOutcomeRanksResult {
  const { isImpersonating = false } = options;
  const [ranks, setRanks] = useState<OutcomeRanks>({ ...DEFAULT_OUTCOME_RANKS });
  const [hasSavedRow, setHasSavedRow] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const isReadOnly = isImpersonating || !householdId;

  const fetchRanks = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!householdId) {
        setRanks({ ...DEFAULT_OUTCOME_RANKS });
        setHasSavedRow(false);
        setRowId(null);
        setLoading(false);
        return;
      }

      if (!opts?.silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const { data: row, error: queryError } = await supabase
          .from("household_outcome_ranks")
          .select(
            "id, household_id, effective_from, effective_to, ranks, source, updated_by, created_at",
          )
          .eq("household_id", householdId)
          .is("effective_to", null)
          .order("effective_from", { ascending: false })
          .limit(1)
          .abortSignal(queryTimeout())
          .maybeSingle();

        if (queryError) throw queryError;

        if (row) {
          const typed = row as HouseholdOutcomeRanksRow;
          setRanks(coerceRanks(typed.ranks));
          setHasSavedRow(true);
          setRowId(typed.id);
        } else {
          setRanks({ ...DEFAULT_OUTCOME_RANKS });
          setHasSavedRow(false);
          setRowId(null);
        }
      } catch (err) {
        // Table missing / RLS / network - fall back to defaults for UI.
        setRanks({ ...DEFAULT_OUTCOME_RANKS });
        setHasSavedRow(false);
        setRowId(null);
        setError(err instanceof Error ? err : new Error("Failed to load outcome ranks"));
      } finally {
        setLoading(false);
      }
    },
    [householdId],
  );

  useEffect(() => {
    void fetchRanks();
  }, [fetchRanks]);

  // Keep Dashboard (kept mounted while Profile is open) in sync after a save.
  useEffect(() => {
    if (typeof window === "undefined" || !householdId) return;

    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ householdId?: string }>).detail;
      if (detail?.householdId && detail.householdId !== householdId) return;
      void fetchRanks({ silent: true });
    };

    window.addEventListener(OUTCOME_RANKS_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(OUTCOME_RANKS_UPDATED_EVENT, onUpdated);
  }, [householdId, fetchRanks]);

  const clearSaveFeedback = useCallback(() => {
    setSaveError(null);
    setSaveSuccess(null);
  }, []);

  const saveOrderedKeys = useCallback(
    async (ordered: OutcomeKey[]): Promise<boolean> => {
      if (isReadOnly) {
        setSaveError("Priorities can't be changed while viewing another household.");
        return false;
      }

      const nextRanks = ranksFromOrderedKeys(ordered);
      if (!validateRanks(nextRanks)) {
        setSaveError("Priorities must include each outcome once (ranks 1-6).");
        return false;
      }

      setSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const updatedBy = user?.email ?? user?.id ?? null;
        const nowIso = new Date().toISOString();

        // Close current version if any.
        if (rowId) {
          const { error: closeError } = await supabase
            .from("household_outcome_ranks")
            .update({ effective_to: nowIso })
            .eq("id", rowId)
            .is("effective_to", null);

          if (closeError) throw closeError;
        } else {
          // Race-safe close of any open row for this household.
          await supabase
            .from("household_outcome_ranks")
            .update({ effective_to: nowIso })
            .eq("household_id", householdId)
            .is("effective_to", null);
        }

        const { data: inserted, error: insertError } = await supabase
          .from("household_outcome_ranks")
          .insert({
            household_id: householdId,
            effective_from: nowIso,
            effective_to: null,
            ranks: nextRanks,
            source: "user",
            updated_by: updatedBy,
          })
          .select(
            "id, household_id, effective_from, effective_to, ranks, source, updated_by, created_at",
          )
          .single();

        if (insertError) throw insertError;

        const typed = inserted as HouseholdOutcomeRanksRow;
        setRanks(coerceRanks(typed.ranks));
        setHasSavedRow(true);
        setRowId(typed.id);
        setSaveSuccess("Priorities saved.");

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(OUTCOME_RANKS_UPDATED_EVENT, {
              detail: { householdId },
            }),
          );
        }
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to save priorities. Please try again.";
        setSaveError(message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [householdId, isReadOnly, rowId],
  );

  const orderedKeys = useMemo(() => sortKeysByRank(ranks), [ranks]);

  return {
    ranks,
    orderedKeys,
    hasSavedRow,
    loading,
    saving,
    error,
    saveError,
    saveSuccess,
    isReadOnly,
    refetch: () => fetchRanks(),
    saveOrderedKeys,
    clearSaveFeedback,
  };
}
