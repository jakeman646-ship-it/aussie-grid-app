/**

 * Aussie Grid — Admin access helpers

 * File: src/lib/adminAccess.ts

 * Version: v0.1.2.24

 * Lines: 66

 * Updated: 8 Jul 2026 — isAdminUser falls back to getSession() when getUser() is empty on production.

 */

import { supabase } from "./supabase";



/** Fallback admin emails when VITE_ADMIN_EMAILS is not set at build time. */

const DEFAULT_ADMIN_EMAILS = ["jakeman646@hotmail.co.uk"];



function parseAdminEmails(): string[] {

  const fromEnv = import.meta.env.VITE_ADMIN_EMAILS;

  if (typeof fromEnv === "string" && fromEnv.trim()) {

    return fromEnv

      .split(",")

      .map((email) => email.trim().toLowerCase())

      .filter(Boolean);

  }

  return DEFAULT_ADMIN_EMAILS.map((email) => email.toLowerCase());

}



/** True when running the Vite dev server (local development). */

export function isDevEnvironment(): boolean {

  return import.meta.env.DEV;

}



/**

 * Basic admin check: signed-in Supabase user email must appear in

 * VITE_ADMIN_EMAILS (comma-separated) or the built-in pilot admin list.

 */

export async function isAdminUser(): Promise<boolean> {

  try {

    // getUser() validates the JWT server-side but can return null on production

    // when the token is present locally but the network round-trip fails or lags.

    const {

      data: { user: userFromGetUser },

    } = await supabase.auth.getUser();



    let user = userFromGetUser;



    // Fall back to the locally cached session — more reliable when the user is

    // already signed in but getUser() did not return a user object.

    if (!user?.email) {

      const {

        data: { session },

      } = await supabase.auth.getSession();

      user = session?.user ?? null;

    }



    if (!user?.email) return false;



    const allowedEmails = parseAdminEmails();

    return allowedEmails.includes(user.email.trim().toLowerCase());

  } catch {

    return false;

  }

}



/** Impersonation is allowed in development or for verified admin users. */

export async function canUseImpersonation(): Promise<boolean> {

  if (isDevEnvironment()) return true;

  return isAdminUser();

}


