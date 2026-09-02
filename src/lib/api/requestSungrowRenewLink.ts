/**
 * Aussie Grid — mint a 30-minute sealed Sungrow authorize URL
 * File: src/lib/api/requestSungrowRenewLink.ts
 * Version: v0.1.0
 * Updated: 2 Sep 2026 — owner/admin Renew; does not mark connected.
 *
 * POST {VITE_API_URL}/auth/sungrow/renew-link
 * Body: { household_id }  Header: Authorization Bearer (Supabase session).
 * Backend does not write sungrow_tokens or connection_status.
 */
import { supabase } from "@/lib/supabase";

export interface SungrowRenewLinkResult {
  authorizeUrl: string;
  expiresAt: string;
  mintedAs: "owner" | "admin";
}

function apiBaseUrl(): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!base) {
    throw new Error(
      "VITE_API_URL is not set. Renew needs the Aussie Grid API (FastAPI)."
    );
  }
  return base.replace(/\/$/, "");
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: string; error?: string; message?: string };
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
    if (typeof data.error === "string" && data.error.trim()) return data.error;
    if (typeof data.message === "string" && data.message.trim()) return data.message;
  } catch {
    // ignore non-JSON
  }
  return `${fallback} (${res.status})`;
}

async function sessionAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token?.trim();
  if (!token) {
    throw new Error("Sign in again to renew this connection.");
  }
  return token;
}

/**
 * Mint a sealed iSolarCloud authorize URL for this household only.
 * Does not clear reauth_required and does not claim connected.
 */
export async function requestSungrowRenewLink(
  householdId: string
): Promise<SungrowRenewLinkResult> {
  const hid = householdId.trim();
  if (!hid) {
    throw new Error("household_id is required");
  }

  const token = await sessionAccessToken();
  const res = await fetch(`${apiBaseUrl()}/auth/sungrow/renew-link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ household_id: hid }),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Could not create a Renew link"));
  }

  const data = (await res.json()) as {
    authorize_url?: string;
    expires_at?: string;
    minted_as?: string;
  };
  const authorizeUrl = (data.authorize_url || "").trim();
  if (!authorizeUrl) {
    throw new Error("API did not return an authorize URL");
  }
  const mintedAs = data.minted_as === "admin" ? "admin" : "owner";
  return {
    authorizeUrl,
    expiresAt: data.expires_at || "",
    mintedAs,
  };
}

export function sungrowRenewClickedStorageKey(householdId: string): string {
  return `ag.sungrowRenewClickedAt.${householdId.trim()}`;
}

export function readSungrowRenewClickedAt(householdId: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(sungrowRenewClickedStorageKey(householdId));
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function markSungrowRenewClicked(householdId: string, atMs: number = Date.now()): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(sungrowRenewClickedStorageKey(householdId), String(atMs));
}
