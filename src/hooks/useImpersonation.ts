/**
 * Aussie Grid — useImpersonation hook
 * File: src/hooks/useImpersonation.ts
 * Version: v0.1.2.25
 * Lines: 86
 * Updated: 9 Jul 2026 — export stopImpersonating() to clear ?impersonate= and reload.
 */
import { useEffect, useState } from "react";
import { canUseImpersonation } from "@/lib/adminAccess";

export interface UseImpersonationResult {
  /** Household ID to load dashboard data for (impersonated or logged-in). */
  effectiveHouseholdId: string;
  /** True when viewing another household via ?impersonate=. */
  isImpersonating: boolean;
  /** Raw value from the impersonate query param (when allowed). */
  impersonatedHouseholdId: string | null;
  /** True while checking whether impersonation is permitted. */
  checking: boolean;
  /** True when ?impersonate= was present but access was denied. */
  denied: boolean;
}

function readImpersonateParam(): string | null {
  if (typeof window === "undefined") return null;

  const requested = new URLSearchParams(window.location.search).get("impersonate");
  const trimmed = requested?.trim();
  return trimmed || null;
}

/**
 * Exit admin impersonation: strip ?impersonate= from the URL and reload so
 * dashboard hooks load the logged-in user's household again.
 */
export function stopImpersonating(): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.delete("impersonate");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.location.replace(next);
}

/**
 * Detects ?impersonate=<household_id> and, when permitted, returns that ID
 * as the effective household for dashboard queries.
 */
export function useImpersonation(loggedInHouseholdId: string): UseImpersonationResult {
  const requestedId = readImpersonateParam();
  const [allowed, setAllowed] = useState(!requestedId);
  const [checking, setChecking] = useState(Boolean(requestedId));

  useEffect(() => {
    if (!requestedId) {
      setAllowed(false);
      setChecking(false);
      return;
    }

    let cancelled = false;

    canUseImpersonation().then((ok) => {
      if (cancelled) return;
      setAllowed(ok);
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [requestedId]);

  const impersonatedHouseholdId = requestedId && allowed ? requestedId : null;
  const isImpersonating = Boolean(impersonatedHouseholdId);
  const denied = Boolean(requestedId && !checking && !allowed);

  return {
    effectiveHouseholdId: impersonatedHouseholdId ?? loggedInHouseholdId,
    isImpersonating,
    impersonatedHouseholdId,
    checking,
    denied,
  };
}
