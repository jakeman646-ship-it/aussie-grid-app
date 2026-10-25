/**
 * Aussie Grid — create a pilot account after the invite matches.
 *
 * Deploy (no user session exists yet, so JWT verification must be off):
 *   supabase functions deploy pilot-signup --no-verify-jwt
 *
 * Secret (Edge Function secret, not a VITE_ variable):
 *   PILOT_INVITE_CODE
 *
 * Also deploy before-user-created and attach it as the Auth hook.
 * Without that hook, GoTrue still accepts a direct signUp.
 * This function never forwards the invite code into user metadata.
 */
import {
  decidePilotSignup,
  messageFromAuthBody,
  mintPilotProof,
  pilotSignupUserMetadata,
  publicSignupResult,
} from "../_shared/pilotInvite.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BODY_CHARS = 8_000;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== "POST") {
    return json({ message: "Pilot signup is not open yet. Ask Aussie Grid for help." }, 405);
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) {
    return json({ message: "Enter an email address." }, 400);
  }

  let body: { email?: unknown; password?: unknown; invite_code?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return json({ message: "Enter an email address." }, 400);
  }

  const decision = await decidePilotSignup({
    email: typeof body.email === "string" ? body.email : "",
    password: typeof body.password === "string" ? body.password : "",
    inviteCode: typeof body.invite_code === "string" ? body.invite_code : "",
    expectedInvite: Deno.env.get("PILOT_INVITE_CODE"),
  });
  if (!decision.ok) return json({ message: decision.message }, decision.status);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim() ?? "";
  if (!supabaseUrl || !anonKey) {
    console.error("pilot-signup: missing SUPABASE_URL or SUPABASE_ANON_KEY");
    return json({ message: "Pilot signup is not open yet. Ask Aussie Grid for help." }, 503);
  }

  const proof = await mintPilotProof(
    decision.email,
    Deno.env.get("PILOT_INVITE_CODE") ?? "",
    Date.now(),
  );

  let authResponse: Response;
  try {
    authResponse = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        email: decision.email,
        password: body.password,
        data: pilotSignupUserMetadata(proof),
      }),
    });
  } catch (err) {
    console.error("pilot-signup: auth request failed", err instanceof Error ? err.name : "error");
    return json({ message: "Could not create the account. Please try again." }, 502);
  }

  const authText = await authResponse.text();
  let authBody: unknown = null;
  if (authText) {
    try {
      authBody = JSON.parse(authText);
    } catch {
      authBody = null;
    }
  }

  if (!authResponse.ok) {
    return json(
      {
        message: messageFromAuthBody(
          authBody,
          "Could not create the account. Check the invite code and try again.",
        ),
      },
      authResponse.status,
    );
  }

  return json(publicSignupResult(authBody), 200);
});
