/**
 * Aussie Grid — impersonation / awaiting-data status helpers
 * File: src/lib/impersonationDataStatus.ts
 * Version: v0.2.0
 * Updated: 19 Jul 2026 — reassuring, forward-looking empty-state copy
 */

/** Shown in Dashboard when impersonating a household that has no registry row or readings yet. */
export const IMPERSONATION_NO_DATA_MESSAGE =
  "You're connected — we're preparing this home's dashboard. Live solar, battery, and grid readings will appear here once the first data arrives. Nothing is wrong.";

/** Shown when the household record loaded but live readings/decisions are still missing. */
export const IMPERSONATION_PARTIAL_DATA_MESSAGE =
  "This home is linked and we're waiting on the first usable data pull. Metrics and energy decisions will fill in automatically — usually within a day of connection.";

/** Household-facing banner when connected (or linked) but live telemetry is not ready yet. */
export const AWAITING_LIVE_DATA_MESSAGE =
  "You're connected and we're preparing your dashboard. Live readings and daily energy suggestions will appear here soon — this can take a little while after a new connection. Everything stays read-only until you choose to activate agent control.";

/** Supabase .single() / .maybeSingle() returns this when no row matches. */
export function isSupabaseNoRowsError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "PGRST116" || /0 rows/i.test(e.message ?? "");
}

/**
 * Pick user-facing copy for impersonation empty/partial data states.
 * Keeps the view calm — missing pilot data is expected, not a failure.
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
    return IMPERSONATION_PARTIAL_DATA_MESSAGE;
  }

  return null;
}
