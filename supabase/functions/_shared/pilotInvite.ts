/**
 * Aussie Grid — pilot invite gate (shared by Edge Functions and tests).
 *
 * The browser must not know PILOT_INVITE_CODE. pilot-signup checks the code
 * the volunteer typed, then asks GoTrue to create the user with a short-lived
 * proof. The before-user-created Auth hook allows the insert only when that
 * proof matches. A direct signUp without the proof is rejected once the hook
 * is attached.
 *
 * The raw invite is not written to auth.users. The proof is bound to the
 * email and expires. It is not the invite code.
 */

export const PROOF_KEY = "ag_pilot_proof";
export const PROOF_AT_KEY = "ag_pilot_proof_at";
export const PROOF_WINDOW_MS = 2 * 60 * 1000;
export const WEBHOOK_TOLERANCE_SEC = 5 * 60;

const textEncoder = new TextEncoder();

export type InviteDecision =
  | { allow: true }
  | { allow: false; message: string; httpCode: number };

export interface PilotProof {
  proof: string;
  at: string;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function decodeWebhookSecret(secret: string): Uint8Array | null {
  let raw = secret.trim();
  if (!raw) return null;
  if (raw.startsWith("v1,")) raw = raw.slice(3);
  if (raw.startsWith("whsec_")) raw = raw.slice("whsec_".length);
  if (!raw) return null;
  return base64ToBytes(raw);
}

async function hmacSha256(keyBytes: Uint8Array, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(message));
  return new Uint8Array(signature);
}

function proofMessage(email: string, at: string): string {
  return `${email.trim().toLowerCase()}|${at}`;
}

/** Case-insensitive. Empty expected code never matches (fail closed). */
export async function invitesMatch(entered: string, expected: string): Promise<boolean> {
  const left = entered.trim();
  const right = expected.trim();
  if (!left || !right) return false;
  const digest = async (value: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", textEncoder.encode(value.toUpperCase())),
    );
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  return timingSafeEqual(a, b);
}

export async function mintPilotProof(
  email: string,
  secret: string,
  nowMs: number,
): Promise<PilotProof> {
  const at = new Date(nowMs).toISOString();
  const signature = await hmacSha256(textEncoder.encode(secret.trim()), proofMessage(email, at));
  return { proof: [...signature].map((byte) => byte.toString(16).padStart(2, "0")).join(""), at };
}

export function pilotSignupUserMetadata(proof: PilotProof): Record<string, string> {
  return {
    [PROOF_KEY]: proof.proof,
    [PROOF_AT_KEY]: proof.at,
  };
}

export async function pilotProofMatches(
  email: string,
  proof: unknown,
  at: unknown,
  secret: string,
  nowMs: number,
): Promise<boolean> {
  const key = secret.trim();
  if (!key || typeof proof !== "string" || typeof at !== "string") return false;
  if (!/^[0-9a-f]{64}$/.test(proof)) return false;
  const atMs = Date.parse(at);
  if (!Number.isFinite(atMs) || Math.abs(nowMs - atMs) > PROOF_WINDOW_MS) return false;
  const expected = await hmacSha256(textEncoder.encode(key), proofMessage(email, at));
  const expectedHex = [...expected].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(textEncoder.encode(proof), textEncoder.encode(expectedHex));
}

export async function decidePilotSignup(input: {
  email: string;
  password: string;
  inviteCode: string;
  expectedInvite: string | undefined;
}): Promise<{ ok: true; email: string } | { ok: false; status: number; message: string }> {
  const expected = input.expectedInvite?.trim() ?? "";
  if (!expected) {
    return {
      ok: false,
      status: 503,
      message: "Pilot signup is not open yet. Ask Aussie Grid for help.",
    };
  }

  const email = input.email.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, message: "Enter an email address." };
  }
  if (input.password.length < 8 || input.password.length > 128) {
    return { ok: false, status: 400, message: "Password must be at least 8 characters." };
  }
  if (!(await invitesMatch(input.inviteCode, expected))) {
    return {
      ok: false,
      status: 403,
      message: "Invite code is wrong. Ask Aussie Grid for a pilot invite.",
    };
  }
  return { ok: true, email };
}

export async function decideBeforeUserCreated(input: {
  email: string;
  userMetadata: unknown;
  secret: string | undefined;
  nowMs: number;
}): Promise<InviteDecision> {
  const secret = input.secret?.trim() ?? "";
  if (!secret) {
    return {
      allow: false,
      message: "Pilot signup is not open yet. Ask Aussie Grid for help.",
      httpCode: 503,
    };
  }

  const metadata =
    input.userMetadata && typeof input.userMetadata === "object"
      ? (input.userMetadata as Record<string, unknown>)
      : {};
  const matches = await pilotProofMatches(
    input.email,
    metadata[PROOF_KEY],
    metadata[PROOF_AT_KEY],
    secret,
    input.nowMs,
  );
  if (!matches) {
    return {
      allow: false,
      message: "Pilot signup was rejected. Ask Aussie Grid for a pilot invite.",
      httpCode: 403,
    };
  }
  return { allow: true };
}

/**
 * Auth reads a hook error object only when the HTTP status is 200 or 202.
 * A 4xx is treated as a failed invocation and hides `error.message`.
 * `error.http_code` is the status the volunteer sees.
 */
export function beforeUserCreatedHttpResponse(decision: InviteDecision): {
  status: number;
  body: string;
} {
  if (decision.allow) return { status: 200, body: "{}" };
  return {
    status: 200,
    body: JSON.stringify({
      error: {
        message: decision.message,
        http_code: decision.httpCode,
      },
    }),
  };
}

export function messageFromAuthBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  for (const key of ["message", "msg", "error_description"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

export function publicSignupResult(body: unknown): {
  user: { identities: unknown[] };
  session: { access_token: string; refresh_token: string } | null;
} {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const nestedUser =
    record.user && typeof record.user === "object"
      ? (record.user as Record<string, unknown>)
      : null;
  const user = nestedUser ?? record;
  const identities = Array.isArray(user.identities) ? user.identities : [];

  const nestedSession =
    record.session && typeof record.session === "object"
      ? (record.session as Record<string, unknown>)
      : null;
  const accessToken =
    typeof record.access_token === "string"
      ? record.access_token
      : typeof nestedSession?.access_token === "string"
        ? nestedSession.access_token
        : "";
  const refreshToken =
    typeof record.refresh_token === "string"
      ? record.refresh_token
      : typeof nestedSession?.refresh_token === "string"
        ? nestedSession.refresh_token
        : "";

  return {
    user: { identities },
    session:
      accessToken && refreshToken
        ? { access_token: accessToken, refresh_token: refreshToken }
        : null,
  };
}

export interface WebhookHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

export async function signStandardWebhook(input: {
  payload: string;
  id: string;
  timestamp: string;
  secret: string;
}): Promise<string | null> {
  const key = decodeWebhookSecret(input.secret);
  if (!key || !input.id || !input.timestamp) return null;
  const signed = `${input.id}.${input.timestamp}.${input.payload}`;
  const signature = await hmacSha256(key, signed);
  return `v1,${bytesToBase64(signature)}`;
}

export async function verifyStandardWebhook(input: {
  payload: string;
  headers: WebhookHeaders;
  secret: string;
  nowMs?: number;
  toleranceSec?: number;
}): Promise<boolean> {
  const key = decodeWebhookSecret(input.secret);
  const id = input.headers.id.trim();
  const timestamp = input.headers.timestamp.trim();
  if (!key || !id || !timestamp) return false;

  const timestampSec = Number(timestamp);
  if (!Number.isFinite(timestampSec)) return false;
  const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const tolerance = input.toleranceSec ?? WEBHOOK_TOLERANCE_SEC;
  if (Math.abs(nowSec - timestampSec) > tolerance) return false;

  const expected = await signStandardWebhook({
    payload: input.payload,
    id,
    timestamp,
    secret: input.secret,
  });
  if (!expected) return false;
  const expectedValue = expected.slice(3);

  const presented = input.headers.signature
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of presented) {
    const value = part.startsWith("v1,") ? part.slice(3) : part;
    const left = textEncoder.encode(value);
    const right = textEncoder.encode(expectedValue);
    if (timingSafeEqual(left, right)) return true;
  }
  return false;
}
