/**
 * Aussie Grid — Supabase Auth hook: before user created.
 *
 * Deploy (Auth calls this with a webhook signature, not a user JWT):
 *   supabase functions deploy before-user-created --no-verify-jwt
 *
 * Secrets (Edge Function secrets, not VITE_ variables):
 *   PILOT_INVITE_CODE                  same value as pilot-signup
 *   BEFORE_USER_CREATED_HOOK_SECRET    v1,whsec_... from Authentication → Hooks
 *
 * Dashboard → Authentication → Hooks → Before user created → HTTPS:
 *   https://<project-ref>.supabase.co/functions/v1/before-user-created
 *
 * Until this hook is enabled, a direct call to GoTrue signUp still creates
 * an account. The Login screen does not call signUp itself.
 */
import {
  beforeUserCreatedHttpResponse,
  decideBeforeUserCreated,
  verifyStandardWebhook,
} from "../_shared/pilotInvite.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const JSON_HEADERS = { "Content-Type": "application/json" };

function header(req: Request, ...names: string[]): string {
  for (const name of names) {
    const value = req.headers.get(name);
    if (value) return value;
  }
  return "";
}

function respond(decision: Parameters<typeof beforeUserCreatedHttpResponse>[0]): Response {
  const result = beforeUserCreatedHttpResponse(decision);
  return new Response(result.body, { status: result.status, headers: JSON_HEADERS });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return respond({
      allow: false,
      message: "Pilot signup is not open yet. Ask Aussie Grid for help.",
      httpCode: 405,
    });
  }

  const payload = await req.text();
  const hookSecret = Deno.env.get("BEFORE_USER_CREATED_HOOK_SECRET") ?? "";
  const inviteSecret = Deno.env.get("PILOT_INVITE_CODE") ?? "";
  if (!hookSecret.trim() || !inviteSecret.trim()) {
    console.error("before-user-created: missing hook secret or PILOT_INVITE_CODE");
    return respond({
      allow: false,
      message: "Pilot signup is not open yet. Ask Aussie Grid for help.",
      httpCode: 503,
    });
  }

  const verified = await verifyStandardWebhook({
    payload,
    headers: {
      id: header(req, "webhook-id", "svix-id"),
      timestamp: header(req, "webhook-timestamp", "svix-timestamp"),
      signature: header(req, "webhook-signature", "svix-signature"),
    },
    secret: hookSecret,
  });
  if (!verified) {
    return respond({
      allow: false,
      message: "Pilot signup could not be verified. Ask Aussie Grid for help.",
      httpCode: 401,
    });
  }

  let event: {
    user?: {
      email?: string;
      user_metadata?: unknown;
      raw_user_meta_data?: unknown;
    };
  };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    return respond({
      allow: false,
      message: "Pilot signup could not be verified. Ask Aussie Grid for help.",
      httpCode: 400,
    });
  }

  const user = event.user ?? {};
  const decision = await decideBeforeUserCreated({
    email: typeof user.email === "string" ? user.email : "",
    userMetadata: user.user_metadata ?? user.raw_user_meta_data ?? {},
    secret: inviteSecret,
    nowMs: Date.now(),
  });
  return respond(decision);
});
