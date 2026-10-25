/**
 * Aussie Grid — interpret the pilot-signup Edge Function response.
 * File: src/lib/pilotSignupResult.ts
 *
 * The invite code is not compared here. pilot-signup and the
 * before-user-created Auth hook do that on the server.
 */

export interface PilotSignupSuccess {
  needsEmailConfirm: boolean;
  accessToken?: string;
  refreshToken?: string;
}

const FALLBACK = "Could not create the account. Check the invite code and try again.";
const NOT_OPEN = "Pilot signup is not open yet. Ask Aussie Grid for help.";

export function messageFromUnknownBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  for (const key of ["message", "msg", "error_description"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function messageFromFunctionError(error: unknown, data: unknown): Promise<string> {
  const fromData = messageFromUnknownBody(data);
  if (fromData) return fromData;

  if (error && typeof error === "object") {
    const name = "name" in error ? String((error as { name: unknown }).name) : "";
    if (name === "FunctionsFetchError" || name === "FunctionsRelayError") return NOT_OPEN;

    if ("context" in error) {
      const context = (error as { context?: unknown }).context;
      if (context instanceof Response) {
        try {
          return messageFromUnknownBody(await context.json()) ?? FALLBACK;
        } catch {
          return FALLBACK;
        }
      }
      const fromContext = messageFromUnknownBody(context);
      if (fromContext) return fromContext;
    }
  }

  return FALLBACK;
}

/** Our function returns `{ user: { identities }, session | null }`, not the raw invite. */
export function interpretSignupPayload(data: unknown): PilotSignupSuccess {
  if (!data || typeof data !== "object") return { needsEmailConfirm: true };
  const body = data as Record<string, unknown>;
  const user =
    body.user && typeof body.user === "object" ? (body.user as Record<string, unknown>) : {};
  const identities = Array.isArray(user.identities) ? user.identities : [];
  const session =
    body.session && typeof body.session === "object"
      ? (body.session as Record<string, unknown>)
      : null;
  const accessToken = typeof session?.access_token === "string" ? session.access_token : "";
  const refreshToken = typeof session?.refresh_token === "string" ? session.refresh_token : "";
  const hasSession = Boolean(accessToken && refreshToken);
  return {
    needsEmailConfirm: !hasSession || identities.length === 0,
    accessToken: accessToken || undefined,
    refreshToken: refreshToken || undefined,
  };
}
