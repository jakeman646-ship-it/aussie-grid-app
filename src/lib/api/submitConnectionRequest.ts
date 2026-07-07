/**
 * Aussie Grid — Connection request submit helper
 * File: src/lib/api/submitConnectionRequest.ts
 * Version: v0.1.2.17
 * Lines: 409
 * Updated: 7 Jul 2026 — fix submit timeout: drop redundant preflight query,
 *          raise mutation/submit timeouts, share one submit abort signal, and
 *          narrow duplicate follow-up to id-only select.
 */
import {
  getSupabaseConfigIssue,
  isSupabaseConfigured,
  mutationTimeout,
  submitTimeout,
  supabase,
} from "@/lib/supabase";
import type { PostgrestError } from "@supabase/supabase-js";

export type InverterMake = "Sungrow" | "Tesla";

export interface SubmitConnectionRequestInput {
  inverterMake: InverterMake;
  householdLabel: string;
  siteId: string;
  accountEmail: string;
  accountPassword?: string;
  inverterSerial?: string;
  notes?: string;
  currentHouseholdId?: string;
}

export type SubmitConnectionRequestResult =
  | { ok: true; householdId: string; reusedPending: boolean }
  | { ok: false; message: string; code?: string };

const RETRY_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 500;

export function resolveHouseholdId(
  label: string,
  siteId: string,
  currentHouseholdId?: string
): string {
  if (label.trim()) {
    return label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40);
  }
  if (currentHouseholdId?.trim()) {
    return currentHouseholdId.trim();
  }
  const short =
    siteId.trim().replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) ||
    Date.now().toString(36);
  return `pending-${short}`;
}

function buildPayload(
  householdId: string,
  input: SubmitConnectionRequestInput
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    household_id: householdId,
    site_id: input.siteId.trim(),
    account_email: input.accountEmail.trim().toLowerCase(),
    inverter_brand: input.inverterMake,
    status: "pending_review",
    requested_at: new Date().toISOString(),
  };

  const notes = input.notes?.trim();
  if (notes) payload.notes = notes;

  const serial = input.inverterSerial?.trim();
  if (serial) payload.inverter_serial = serial;

  if (input.accountPassword?.trim()) {
    payload.account_password = input.accountPassword;
  }

  return payload;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function isAbortError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const name = "name" in error ? String((error as { name: unknown }).name) : "";
  const code = "code" in error ? String((error as { code: unknown }).code) : "";
  const message = errorMessage(error).toLowerCase();
  return (
    name === "AbortError" ||
    code === "ABORT_ERR" ||
    message.includes("aborted") ||
    message.includes("timeout")
  );
}

export function isTransientFetchError(error: unknown): boolean {
  if (isAbortError(error)) return false;

  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    return msg.includes("fetch") || msg.includes("network");
  }

  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("load failed") ||
    message.includes("fetch failed") ||
    message.includes("fetcherror")
  );
}

export function mapConnectionSubmitError(
  error: PostgrestError | Error
): string {
  const code = "code" in error ? error.code : undefined;
  const message = error.message ?? "Failed to submit request.";

  if (!isSupabaseConfigured) {
    return (
      "This deployment was built without database credentials. Add VITE_SUPABASE_URL and " +
      "VITE_SUPABASE_ANON_KEY in Vercel (SUPABASE_URL / publishable key aliases also work), " +
      "then trigger a new deployment."
    );
  }

  const configIssue = getSupabaseConfigIssue();
  if (configIssue) {
    return `Database configuration problem: ${configIssue}. Fix env vars in Vercel and redeploy.`;
  }

  if (isAbortError(error)) {
    return (
      "The request timed out before the database responded. This can happen on slow mobile " +
      "connections — please wait a moment and try again."
    );
  }

  if (code === "42501" || message.toLowerCase().includes("row-level security")) {
    return "We could not save your request due to a database permissions issue. Our team has been notified — please try again shortly or email support.";
  }

  if (
    code === "PGRST204" ||
    message.toLowerCase().includes("could not find") ||
    message.toLowerCase().includes("schema cache")
  ) {
    return "The connection form is temporarily out of date with our database. Please refresh the page and try again, or contact support.";
  }

  if (code === "23505" || message.toLowerCase().includes("duplicate")) {
    return "A connection request for this household is already being reviewed. We'll email you when it's approved.";
  }

  if (
    message.toLowerCase().includes("invalid jwt") ||
    message.toLowerCase().includes("invalid api key") ||
    code === "401"
  ) {
    return "Database API key was rejected. Verify VITE_SUPABASE_ANON_KEY (legacy anon JWT or sb_publishable_ key) in Vercel, then redeploy.";
  }

  if (isTransientFetchError(error) || message.toLowerCase().includes("network")) {
    return (
      "Could not reach the database (network error). Check your connection and try again. " +
      "If you recently added env vars in Vercel, redeploy so they are baked into the production build."
    );
  }

  return message || "Failed to submit request. Please try again or contact support.";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type SupabaseResult = { error: PostgrestError | null };

function requestSignal(flowSignal: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([flowSignal, mutationTimeout()]);
  }
  return flowSignal;
}

/** Retry mutations when PostgREST returns fetch failures in { error } (POST is not retried by the client). */
async function runWithNetworkRetry<T extends SupabaseResult>(
  operation: () => PromiseLike<T>
): Promise<T> {
  let lastResult: T | undefined;
  let lastThrown: unknown;

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await operation();
      lastResult = result;

      if (!result.error || !isTransientFetchError(result.error)) {
        return result;
      }

      if (attempt < RETRY_ATTEMPTS - 1) {
        await delay(RETRY_BASE_DELAY_MS * (attempt + 1));
      }
    } catch (err) {
      lastThrown = err;
      if (!isTransientFetchError(err) || attempt === RETRY_ATTEMPTS - 1) {
        throw err;
      }
      await delay(RETRY_BASE_DELAY_MS * (attempt + 1));
    }
  }

  if (lastResult) return lastResult;
  throw lastThrown ?? new Error("Database request failed.");
}

/** Optional lightweight ping — not called on the submit hot path (status check covers it). */
export async function verifySupabaseReachable(): Promise<{
  ok: boolean;
  message?: string;
}> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      message: mapConnectionSubmitError(new Error("Supabase not configured")),
    };
  }

  const configIssue = getSupabaseConfigIssue();
  if (configIssue) {
    return {
      ok: false,
      message: mapConnectionSubmitError(new Error(configIssue)),
    };
  }

  try {
    const { error } = await supabase
      .from("pilot_connection_requests")
      .select("id")
      .limit(0)
      .abortSignal(mutationTimeout());

    if (error) {
      return { ok: false, message: mapConnectionSubmitError(error) };
    }

    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      message: mapConnectionSubmitError(
        err instanceof Error ? err : new Error(errorMessage(err))
      ),
    };
  }
}

async function findPendingRequest(householdId: string, flowSignal: AbortSignal) {
  const { data, error } = await runWithNetworkRetry(async () =>
    supabase
      .from("pilot_connection_requests")
      .select("id")
      .eq("household_id", householdId)
      .eq("status", "pending_review")
      .limit(1)
      .abortSignal(requestSignal(flowSignal))
      .maybeSingle()
  );

  if (error) return { data: null, error };
  return { data, error: null };
}

async function updatePendingRequest(
  requestId: string,
  payload: Record<string, unknown>,
  flowSignal: AbortSignal
): Promise<PostgrestError | null> {
  const { error } = await runWithNetworkRetry(async () =>
    supabase
      .from("pilot_connection_requests")
      .update({
        site_id: payload.site_id,
        account_email: payload.account_email,
        inverter_brand: payload.inverter_brand,
        notes: payload.notes ?? null,
        inverter_serial: payload.inverter_serial ?? null,
        account_password: payload.account_password ?? null,
        requested_at: payload.requested_at,
        status: "pending_review",
      })
      .eq("id", requestId)
      .abortSignal(requestSignal(flowSignal))
  );

  return error;
}

export async function submitConnectionRequest(
  input: SubmitConnectionRequestInput
): Promise<SubmitConnectionRequestResult> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      message: mapConnectionSubmitError(new Error("Supabase not configured")),
      code: "ENV_MISSING",
    };
  }

  const configIssue = getSupabaseConfigIssue();
  if (configIssue) {
    return {
      ok: false,
      message: mapConnectionSubmitError(new Error(configIssue)),
      code: "ENV_INVALID",
    };
  }

  const householdId = resolveHouseholdId(
    input.householdLabel,
    input.siteId,
    input.currentHouseholdId
  );
  const payload = buildPayload(householdId, input);
  const flowSignal = submitTimeout();

  try {
    const { error: insertError } = await runWithNetworkRetry(async () =>
      supabase
        .from("pilot_connection_requests")
        .insert(payload)
        .abortSignal(requestSignal(flowSignal))
    );

    if (!insertError) {
      return { ok: true, householdId, reusedPending: false };
    }

    const isDuplicate =
      insertError.code === "23505" ||
      insertError.message?.toLowerCase().includes("duplicate");

    if (isDuplicate) {
      const pendingResult = await findPendingRequest(householdId, flowSignal);
      if (pendingResult.error) {
        return {
          ok: false,
          message: mapConnectionSubmitError(pendingResult.error),
          code: pendingResult.error.code,
        };
      }

      if (pendingResult.data?.id) {
        const updateError = await updatePendingRequest(
          pendingResult.data.id,
          payload,
          flowSignal
        );
        if (!updateError) {
          return { ok: true, householdId, reusedPending: true };
        }
        return {
          ok: false,
          message: mapConnectionSubmitError(updateError),
          code: updateError.code,
        };
      }

      return {
        ok: true,
        householdId,
        reusedPending: true,
      };
    }

    return {
      ok: false,
      message: mapConnectionSubmitError(insertError),
      code: insertError.code,
    };
  } catch (err: unknown) {
    console.error("Connection request submit failed:", err);
    const mapped = mapConnectionSubmitError(
      err instanceof Error ? err : new Error(errorMessage(err))
    );
    return {
      ok: false,
      message: mapped,
      code: isTransientFetchError(err) ? "NETWORK" : "SUBMIT_FAILED",
    };
  }
}
