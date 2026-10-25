/**
 * Aussie Grid — connection request secret guard
 * File: src/lib/api/connectionSecrets.ts
 *
 * The anon Supabase client must never send recoverable OEM passwords.
 * Sungrow owner approval is POST /auth/sungrow/renew-link on the API
 * (see requestSungrowRenewLink). There is no Tesla equivalent in this repo.
 * Until a server-side Tesla owner-authorize flow (or a server-side secret
 * manager) exists, Tesla requests may store only non-secret metadata.
 */

/** Columns that would store a recoverable credential if the anon client sent them. */
export const RECOVERABLE_SECRET_COLUMNS = ["account_password"] as const;

export function omitRecoverableSecrets<T extends Record<string, unknown>>(payload: T): T {
  const next = { ...payload };
  for (const column of RECOVERABLE_SECRET_COLUMNS) {
    if (column in next) delete next[column];
  }
  return next;
}
