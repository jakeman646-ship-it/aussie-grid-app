/**
 * Aussie Grid — pilot Create account
 * File: src/lib/api/pilotSignup.ts
 *
 * Calls the pilot-signup Edge Function. Does not compare an invite code
 * and does not call GoTrue signup from the browser. The function checks
 * PILOT_INVITE_CODE.
 * The before-user-created hook rejects signups that skipped the function.
 */
import { supabase } from "@/lib/supabase";
import {
  interpretSignupPayload,
  messageFromFunctionError,
  type PilotSignupSuccess,
} from "@/lib/pilotSignupResult";

export async function signUpWithPilotInvite(
  email: string,
  password: string,
  inviteCode: string,
): Promise<{ ok: true } & PilotSignupSuccess | { ok: false; message: string }> {
  const { data, error } = await supabase.functions.invoke("pilot-signup", {
    body: {
      email: email.trim(),
      password,
      invite_code: inviteCode.trim(),
    },
  });

  if (error) {
    return { ok: false, message: await messageFromFunctionError(error, data) };
  }

  const parsed = interpretSignupPayload(data);
  if (parsed.accessToken && parsed.refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
    });
    if (sessionError) return { ok: false, message: sessionError.message };
  }

  return { ok: true, ...parsed };
}
