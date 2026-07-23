/**
 * Aussie Grid — Current household helpers
 * File: src/lib/currentHousehold.ts
 * Version: v0.1.2.26
 * Updated: 24 Jul 2026 — DEV-only sungrow-test-001 fallback; email mapping in prod (security 2).
 */
import { supabase, queryTimeout } from "@/lib/supabase";

const STORAGE_KEY = "aussie_grid_current_household_id";
/** Safe DEV fallback only — never the production default for logged-in users. */
const DEV_FALLBACK_HOUSEHOLD_ID = "sungrow-test-001";

function isDev(): boolean {
  return import.meta.env.DEV;
}

/**
 * Resolve the active household id for the UI.
 * Prefer localStorage (DEV switcher). Otherwise empty in production —
 * App resolves via email mapping. DEV may fall back to sungrow-test-001.
 */
export function getCurrentHouseholdId(): string {
  if (typeof window === "undefined") {
    return isDev() ? DEV_FALLBACK_HOUSEHOLD_ID : "";
  }

  const stored = localStorage.getItem(STORAGE_KEY)?.trim();
  if (stored) return stored;

  if (isDev()) return DEV_FALLBACK_HOUSEHOLD_ID;
  return "";
}

export function setCurrentHouseholdId(householdId: string): void {
  if (typeof window === "undefined") return;
  const trimmed = householdId.trim();
  if (!trimmed) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, trimmed);
}

/** Remove stored household override (e.g. on sign-out). Does not reload the page. */
export function clearCurrentHouseholdId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Map auth email → pilot_households.household_id (first match).
 * Not RLS enforcement — stops defaulting everyone to sungrow-test-001 when a row exists.
 */
export async function resolveHouseholdIdFromEmail(
  email: string | null | undefined,
): Promise<string | null> {
  const normalised = (email || "").trim().toLowerCase();
  if (!normalised) return null;

  try {
    const { data, error } = await supabase
      .from("pilot_households")
      .select("household_id")
      .ilike("email", normalised)
      .limit(1)
      .abortSignal(queryTimeout())
      .maybeSingle();

    if (error || !data?.household_id) return null;
    return String(data.household_id).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Pick household id for a signed-in session.
 * Production: email → pilot_households when a row exists; never default to sungrow-test-001.
 * DEV: localStorage (switcher) → email mapping → sungrow-test-001 fallback.
 */
export async function resolveHouseholdIdForSession(
  email: string | null | undefined,
): Promise<string> {
  if (isDev()) {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY)?.trim();
      if (stored) return stored;
    }

    const mappedDev = await resolveHouseholdIdFromEmail(email);
    if (mappedDev) {
      setCurrentHouseholdId(mappedDev);
      return mappedDev;
    }

    return DEV_FALLBACK_HOUSEHOLD_ID;
  }

  // Production — prefer real email mapping; clear stale local overrides if unmapped.
  const mapped = await resolveHouseholdIdFromEmail(email);
  if (mapped) {
    setCurrentHouseholdId(mapped);
    return mapped;
  }

  clearCurrentHouseholdId();
  return "";
}

/** Helper for DEV — clear override and reload. */
export function resetToDefaultHousehold(): void {
  clearCurrentHouseholdId();
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}
