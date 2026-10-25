import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  beforeUserCreatedHttpResponse,
  decideBeforeUserCreated,
  decidePilotSignup,
  invitesMatch,
  mintPilotProof,
  pilotProofMatches,
  pilotSignupUserMetadata,
  PROOF_AT_KEY,
  PROOF_KEY,
  publicSignupResult,
  signStandardWebhook,
  verifyStandardWebhook,
} from "../supabase/functions/_shared/pilotInvite.ts";
import { interpretSignupPayload } from "../src/lib/pilotSignupResult.ts";

const SECRET = "pilot-invite-test-secret";
const NOW = Date.parse("2026-10-26T00:00:00.000Z");

test("invite match is case-insensitive and fail closed when unset", async () => {
  assert.equal(await invitesMatch("volunteer", "VOLUNTEER"), true);
  assert.equal(await invitesMatch("nope", "VOLUNTEER"), false);
  assert.equal(await invitesMatch("anything", ""), false);
  assert.equal(await invitesMatch("", "VOLUNTEER"), false);
});

test("signup decision rejects a missing server secret and a wrong code", async () => {
  const closed = await decidePilotSignup({
    email: "a@example.com",
    password: "long-enough",
    inviteCode: "anything",
    expectedInvite: "  ",
  });
  assert.equal(closed.ok, false);
  if (!closed.ok) assert.equal(closed.status, 503);

  const wrong = await decidePilotSignup({
    email: "a@example.com",
    password: "long-enough",
    inviteCode: "nope",
    expectedInvite: SECRET,
  });
  assert.equal(wrong.ok, false);
  if (!wrong.ok) assert.equal(wrong.status, 403);

  const ok = await decidePilotSignup({
    email: " A@Example.com ",
    password: "long-enough",
    inviteCode: secretMixed(SECRET),
    expectedInvite: SECRET,
  });
  assert.deepEqual(ok, { ok: true, email: "a@example.com" });
});

function secretMixed(value: string): string {
  return value
    .split("")
    .map((char, index) => (index % 2 === 0 ? char.toUpperCase() : char.toLowerCase()))
    .join("");
}

test("proof is email-bound, expires, and is the only signup metadata", async () => {
  const proof = await mintPilotProof("Owner@Example.com", SECRET, NOW);
  assert.equal(await pilotProofMatches("owner@example.com", proof.proof, proof.at, SECRET, NOW), true);
  assert.equal(
    await pilotProofMatches("other@example.com", proof.proof, proof.at, SECRET, NOW),
    false,
  );
  assert.equal(
    await pilotProofMatches("owner@example.com", proof.proof, proof.at, "other-secret", NOW),
    false,
  );
  assert.equal(
    await pilotProofMatches(
      "owner@example.com",
      proof.proof,
      proof.at,
      SECRET,
      NOW + 3 * 60 * 1000,
    ),
    false,
  );

  assert.deepEqual(Object.keys(pilotSignupUserMetadata(proof)).sort(), [
    PROOF_KEY,
    PROOF_AT_KEY,
  ]);
  assert.equal(JSON.stringify(pilotSignupUserMetadata(proof)).includes("invite"), false);
});

test("hook allows a fresh proof and rejects a direct signup", async () => {
  const proof = await mintPilotProof("owner@example.com", SECRET, NOW);
  const allowed = await decideBeforeUserCreated({
    email: "owner@example.com",
    userMetadata: pilotSignupUserMetadata(proof),
    secret: SECRET,
    nowMs: NOW,
  });
  assert.deepEqual(allowed, { allow: true });

  const rejected = await decideBeforeUserCreated({
    email: "owner@example.com",
    userMetadata: { invite_code: SECRET },
    secret: SECRET,
    nowMs: NOW,
  });
  assert.equal(rejected.allow, false);

  const closed = await decideBeforeUserCreated({
    email: "owner@example.com",
    userMetadata: pilotSignupUserMetadata(proof),
    secret: "",
    nowMs: NOW,
  });
  assert.equal(closed.allow, false);

  const http = beforeUserCreatedHttpResponse(rejected);
  assert.equal(http.status, 200);
  const body = JSON.parse(http.body) as { error: { message: string; http_code: number } };
  assert.equal(typeof body.error.message, "string");
  assert.equal(body.error.http_code, 403);
});

test("webhook signature round trip rejects tampering and stale timestamps", async () => {
  const key = new Uint8Array(24);
  for (let i = 0; i < key.length; i++) key[i] = i + 1;
  let binary = "";
  for (const byte of key) binary += String.fromCharCode(byte);
  const secret = `v1,whsec_${btoa(binary)}`;
  const payload = JSON.stringify({ user: { email: "owner@example.com" } });
  const timestamp = String(Math.floor(NOW / 1000));
  const signature = await signStandardWebhook({
    payload,
    id: "msg_test",
    timestamp,
    secret,
  });
  assert.ok(signature);

  const headers = { id: "msg_test", timestamp, signature: signature ?? "" };
  assert.equal(await verifyStandardWebhook({ payload, headers, secret, nowMs: NOW }), true);
  assert.equal(
    await verifyStandardWebhook({ payload: `${payload} `, headers, secret, nowMs: NOW }),
    false,
  );
  assert.equal(
    await verifyStandardWebhook({
      payload,
      headers,
      secret,
      nowMs: NOW + 10 * 60 * 1000,
    }),
    false,
  );
});

test("public signup result drops auth metadata and keeps a session", () => {
  const result = publicSignupResult({
    access_token: "access",
    refresh_token: "refresh",
    user: {
      identities: [{ provider: "email" }],
      user_metadata: { ag_pilot_proof: "secret-ish" },
    },
  });
  assert.deepEqual(result, {
    user: { identities: [{ provider: "email" }] },
    session: { access_token: "access", refresh_token: "refresh" },
  });
  assert.equal(JSON.stringify(result).includes("ag_pilot_proof"), false);

  const pending = interpretSignupPayload({
    user: { identities: [] },
    session: null,
  });
  assert.equal(pending.needsEmailConfirm, true);

  const signedIn = interpretSignupPayload(result);
  assert.equal(signedIn.needsEmailConfirm, false);
  assert.equal(signedIn.accessToken, "access");
});

test("shipped client does not embed an invite code", () => {
  const files = [
    "../src/components/Login.tsx",
    "../src/lib/api/pilotSignup.ts",
    "../src/lib/pilotSignupResult.ts",
    "../vite.config.ts",
    "../.env.example",
  ];
  for (const relative of files) {
    const source = readFileSync(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /VOLUNTEER/);
    assert.doesNotMatch(source, /VITE_PILOT_INVITE_CODE\s*=/);
    assert.doesNotMatch(source, /import\.meta\.env\.VITE_PILOT_INVITE_CODE/);
    assert.doesNotMatch(source, /inviteMatches/);
    assert.doesNotMatch(source, /supabase\.auth\.signUp/);
  }
  const login = readFileSync(new URL("../src/components/Login.tsx", import.meta.url), "utf8");
  assert.match(login, /signUpWithPilotInvite/);
  assert.doesNotMatch(login, /VITE_PILOT_INVITE_CODE/);
});
