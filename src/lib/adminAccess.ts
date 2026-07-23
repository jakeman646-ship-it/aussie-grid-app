/**
 * Aussie Grid — Admin access helpers
 * File: src/lib/adminAccess.ts
 * Version: v0.1.2.26
 * Updated: 24 Jul 2026 — fail closed: VITE_ADMIN_EMAILS only (no hardcoded emails).
 */
import { supabase } from "./supabase";

/**
 * Admin emails from build-time env only (comma-separated).
 * If unset or empty, nobody is admin — fail closed for impersonation UX.
 */
function parseAdminEmails(): string[] {
  const fromEnv = import.meta.env.VITE_ADMIN_EMAILS;
  if (typeof fromEnv !== "string" || !fromEnv.trim()) {
    return [];
  }

  return fromEnv
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** True when running the Vite dev server (local development). */
export function isDevEnvironment(): boolean {
  return import.meta.env.DEV;
}

/**
 * Basic admin check: signed-in Supabase user email must appear in
 * VITE_ADMIN_EMAILS. No hardcoded fallback list in the shipped bundle.
 */
export async function isAdminUser(): Promise<boolean> {
  try {
    const allowedEmails = parseAdminEmails();
    if (allowedEmails.length === 0) return false;

    // getUser() validates the JWT server-side but can return null on production
    // when the token is present locally but the network round-trip fails or lags.
    const {
      data: { user: userFromGetUser },
    } = await supabase.auth.getUser();

    let user = userFromGetUser;

    // Fall back to the locally cached session — more reliable when the user is
    // already signed in but getUser() did not return a user object.
    if (!user?.email) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      user = session?.user ?? null;
    }

    if (!user?.email) return false;

    return allowedEmails.includes(user.email.trim().toLowerCase());
  } catch {
    return false;
  }
}

/** Impersonation is allowed in development or for verified admin users. */
export async function canUseImpersonation(): Promise<boolean> {
  if (isDevEnvironment()) return true;
  return isAdminUser();
}
