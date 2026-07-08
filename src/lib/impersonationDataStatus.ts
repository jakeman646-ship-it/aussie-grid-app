/**
 * Aussie Grid — impersonation data status helpers
 * File: src/lib/impersonationDataStatus.ts
 * Version: v0.1.2.24
 * Lines: 52
 * Updated: 9 Jul 2026 — soft empty-state copy when admin impersonates a household with no data yet.
 */

/** Shown in Dashboard when impersonating a household that has no registry row or readings yet. */
export const IMPERSONATION_NO_DATA_MESSAGE =
  "This household has no data yet. This is normal for new connections. You can still connect their inverter below.";

/** Shown when the household record loaded but live readings/decisions are still missing. */
export const IMPERSONATION_PARTIAL_DATA_MESSAGE =
  "Live readings aren't available for this household yet. This is normal for new connections. You can still connect their inverter below.";

/** Supabase .single() / .maybeSingle() returns this when no row matches. */
export function isSupabaseNoRowsError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "PGRST116" || /0 rows/i.test(e.message ?? "");
}

/**
 * Pick user-facing copy for impersonation empty/partial data states.
 * Keeps admin view calm — missing pilot data is expected, not a failure.
 */
export function getImpersonationDataNotice(options: {
  householdMissing: boolean;
  hasQueryError: boolean;
  hasLiveSnapshot: boolean;
}): string | null {
  const { householdMissing, hasQueryError, hasLiveSnapshot } = options;

  if (householdMissing) {
    return IMPERSONATION_NO_DATA_MESSAGE;
  }

  if (hasQueryError) {
    return hasLiveSnapshot
      ? IMPERSONATION_PARTIAL_DATA_MESSAGE
      : IMPERSONATION_NO_DATA_MESSAGE;
  }

  if (!hasLiveSnapshot) {
    return IMPERSONATION_NO_DATA_MESSAGE;
  }

  return null;
}
