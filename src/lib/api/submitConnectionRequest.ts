/**
 * Aussie Grid — Connection request submit helper
 * File: src/lib/api/submitConnectionRequest.ts
 * Version: v0.1.4.0
 * Updated: 7 Aug 2026 — Energex optional retail_* (¢ UI → store $/kWh); soft-drop columns.
 */
import {
  getSupabaseConfigIssue,
  isSupabaseConfigured,
  mutationTimeout,
  submitTimeout,
  supabase,
} from "@/lib/supabase";
import {
  defaultTariffProfile,
  lookupDnsp,
  normalisePostcode,
} from "@/lib/dnspLookup";
import type { PostgrestError } from "@supabase/supabase-js";

export type InverterMake = "Sungrow" | "Tesla";

export interface SubmitConnectionRequestInput {
  inverterMake: InverterMake;
  householdLabel: string;
  phaseCount: 1 | 3;
  siteId: string;
  accountEmail: string;
  accountPassword?: string;
  inverterSerial?: string;
  notes?: string;
  currentHouseholdId?: string;
  /** Recommended location fields (not required to submit). */
  postcode?: string;
  suburb?: string;
  state?: string;
  /**
   * Energex-only bill rates in ¢/kWh (plain AU display).
   * Converted to $/kWh for DB (same convention as CEO Confirm retail).
   * All optional — blank → omit; submit still succeeds.
   */
  retailPeakCents?: string;
  retailShoulderCents?: string;
  retailOffPeakCents?: string;
  retailFitCents?: string;
}

export type SubmitConnectionRequestResult =
  | { ok: true; householdId: string; reusedPending: boolean }
  | { ok: false; message: string; code?: string };

const RETRY_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 500;

/** Optional columns — dropped one-by-one if PostgREST schema cache rejects them. */
const OPTIONAL_REQUEST_COLUMNS = [
  "postcode",
  "suburb",
  "state",
  "dnsp",
  "network_tariff_profile",
  "retail_plan_id",
  "retail_peak_rate",
  "retail_shoulder_rate",
  "retail_off_peak_rate",
  "retail_fit_rate",
  "phase_count",
  "inverter_serial",
  "account_password",
  "notes",
] as const;

const HOUSEHOLD_SYNC_KEYS = [
  "postcode",
  "suburb",
  "state",
  "dnsp",
  "network_tariff_profile",
  "retail_peak_rate",
  "retail_shoulder_rate",
  "retail_off_peak_rate",
  "retail_fit_rate",
] as const;

/** Convert ¢/kWh display string → $/kWh for pilot_* retail_* columns. */
export function centsPerKwhToAud(cents: string | undefined | null): number | null {
  if (cents === null || cents === undefined) return null;
  const cleaned = String(cents).trim().replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round((n / 100) * 1e6) / 1e6;
}

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

function buildLocationFields(
  input: SubmitConnectionRequestInput
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const suburb = input.suburb?.trim();
  if (suburb) fields.suburb = suburb;

  const stateRaw = input.state?.trim();
  if (stateRaw) fields.state = stateRaw.toUpperCase();

  const pc = normalisePostcode(input.postcode);
  if (pc !== null) {
    fields.postcode = String(pc).padStart(4, "0").slice(-4);
    const dnsp = lookupDnsp(pc);
    if (dnsp) {
      fields.dnsp = dnsp;
      const profile = defaultTariffProfile(dnsp);
      if (profile) fields.network_tariff_profile = profile;
    }
  }

  return fields;
}

/**
 * Energex-only: attach retail_* in $/kWh when DNSP is energex and cents were entered.
 * Never writes retail_* for Ergon. Does not invent rates.
 */
function buildRetailFields(
  input: SubmitConnectionRequestInput,
  locationFields: Record<string, unknown>
): Record<string, unknown> {
  const dnsp = String(locationFields.dnsp || "").toLowerCase();
  const profile = String(locationFields.network_tariff_profile || "").toLowerCase();
  const isEnergex = dnsp === "energex" || profile === "energex_ntc6900";
  if (!isEnergex) return {};

  const fields: Record<string, unknown> = {};
  const peak = centsPerKwhToAud(input.retailPeakCents);
  const shoulder = centsPerKwhToAud(input.retailShoulderCents);
  const offPeak = centsPerKwhToAud(input.retailOffPeakCents);
  const fit = centsPerKwhToAud(input.retailFitCents);

  if (peak !== null) fields.retail_peak_rate = peak;
  if (shoulder !== null) fields.retail_shoulder_rate = shoulder;
  if (offPeak !== null) fields.retail_off_peak_rate = offPeak;
  if (fit !== null) fields.retail_fit_rate = fit;

  return fields;
}

function buildPayload(
  householdId: string,
  input: SubmitConnectionRequestInput
): Record<string, unknown> {
  const locationFields = buildLocationFields(input);
  const payload: Record<string, unknown> = {
    household_id: householdId,
    site_id: input.siteId.trim(),
    account_email: input.accountEmail.trim().toLowerCase(),
    inverter_brand: input.inverterMake,
    phase_count: input.phaseCount,
    status: "pending_review",
    requested_at: new Date().toISOString(),
    ...locationFields,
    ...buildRetailFields(input, locationFields),
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

function dropMissingColumn(
  payload: Record<string, unknown>,
  error: PostgrestError | Error
): string | null {
  const message = (error.message ?? "").toLowerCase();
  const schemaMiss =
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("schema cache") ||
    ("code" in error && error.code === "PGRST204");
  if (!schemaMiss) return null;
  for (const col of OPTIONAL_REQUEST_COLUMNS) {
    if (col in payload && message.includes(col.toLowerCase())) return col;
  }
  // Also allow dropping location keys that may appear on household sync payloads.
  for (const col of Object.keys(payload)) {
    if (col === "updated_at" || col === "household_id") continue;
    if (message.includes(col.toLowerCase())) return col;
  }
  return null;
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
  let working: Record<string, unknown> = {
    site_id: payload.site_id,
    account_email: payload.account_email,
    inverter_brand: payload.inverter_brand,
    phase_count: payload.phase_count,
    notes: payload.notes ?? null,
    inverter_serial: payload.inverter_serial ?? null,
    account_password: payload.account_password ?? null,
    requested_at: payload.requested_at,
    status: "pending_review",
  };

  for (const key of HOUSEHOLD_SYNC_KEYS) {
    if (key in payload) working[key] = payload[key];
  }

  for (let i = 0; i < OPTIONAL_REQUEST_COLUMNS.length + 2; i++) {
    const { error } = await runWithNetworkRetry(async () =>
      supabase
        .from("pilot_connection_requests")
        .update(working)
        .eq("id", requestId)
        .abortSignal(requestSignal(flowSignal))
    );
    if (!error) return null;
    const drop = dropMissingColumn(working, error);
    if (!drop) return error;
    const next = { ...working };
    delete next[drop];
    working = next;
  }
  return null;
}

/**
 * Best-effort: write location + suggested tariff + retail_* onto pilot_households
 * when the row already exists. Never fails the connection submit.
 */
async function syncLocationToHousehold(
  householdId: string,
  payload: Record<string, unknown>,
  flowSignal: AbortSignal
): Promise<void> {
  const locationPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const key of HOUSEHOLD_SYNC_KEYS) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== "") {
      locationPatch[key] = payload[key];
    }
  }
  if (Object.keys(locationPatch).length <= 1) return;

  let working = { ...locationPatch };
  for (let i = 0; i < OPTIONAL_REQUEST_COLUMNS.length + 2; i++) {
    try {
      const { error } = await runWithNetworkRetry(async () =>
        supabase
          .from("pilot_households")
          .update(working)
          .eq("household_id", householdId)
          .abortSignal(requestSignal(flowSignal))
      );
      if (!error) return;
      const drop = dropMissingColumn(working, error);
      if (!drop || drop === "updated_at") {
        console.warn("[submit] household location sync skipped:", error.message);
        return;
      }
      const next = { ...working };
      delete next[drop];
      working = next;
    } catch (err) {
      console.warn("[submit] household location sync failed:", err);
      return;
    }
  }
}

async function insertWithOptionalDrop(
  payload: Record<string, unknown>,
  flowSignal: AbortSignal
): Promise<PostgrestError | null> {
  let working = { ...payload };
  for (let i = 0; i < OPTIONAL_REQUEST_COLUMNS.length + 2; i++) {
    const { error } = await runWithNetworkRetry(async () =>
      supabase
        .from("pilot_connection_requests")
        .insert(working)
        .abortSignal(requestSignal(flowSignal))
    );
    if (!error) return null;
    const drop = dropMissingColumn(working, error);
    if (!drop) return error;
    console.warn(`[submit] dropping missing column ${drop} from connection request`);
    const next = { ...working };
    delete next[drop];
    working = next;
  }
  return null;
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
    const insertError = await insertWithOptionalDrop(payload, flowSignal);

    if (!insertError) {
      await syncLocationToHousehold(householdId, payload, flowSignal);
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
          await syncLocationToHousehold(householdId, payload, flowSignal);
          return { ok: true, householdId, reusedPending: true };
        }
        return {
          ok: false,
          message: mapConnectionSubmitError(updateError),
          code: updateError.code,
        };
      }

      await syncLocationToHousehold(householdId, payload, flowSignal);
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
