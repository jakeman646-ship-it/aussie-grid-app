/**
 * Aussie Grid — Connection request approve/reject API
 * File: src/lib/api/approveConnectionRequest.ts
 * Version: v0.1.2.26
 * Updated: 26 Oct 2026 — drop account_password from the client row type.
 *          Approve/reject still goes through the backend (service_role).
 */

export interface ConnectionRequestRow {
  id: string;
  household_id: string;
  site_id: string;
  account_email: string;
  inverter_brand: string | null;
  inverter_serial?: string | null;
  notes?: string | null;
}

export type ApproveConnectionAction = "added" | "updated";

function apiBaseUrl(): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!base) {
    throw new Error(
      "VITE_API_URL is not set. Approve/reject must go through the backend after RLS hardening."
    );
  }
  return base.replace(/\/$/, "");
}

async function postConnectionRequestAction(
  requestId: string,
  action: "approve" | "reject",
  body?: Record<string, unknown>
): Promise<Response> {
  return fetch(`${apiBaseUrl()}/connection-requests/${requestId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: string; message?: string };
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
    if (typeof data.message === "string" && data.message.trim()) return data.message;
  } catch {
    // ignore non-JSON error bodies
  }
  return `${fallback} (${res.status})`;
}

export function getTeslaMissingFields(req: ConnectionRequestRow): string[] {
  const missing: string[] = [];
  if (!req.site_id?.trim()) missing.push("Energy Site ID");
  if (!req.account_email?.trim()) missing.push("Tesla account email");
  // The anon client must not read or write Tesla account passwords.
  // Owner authorize has to live on the server (Sungrow uses /auth/sungrow/renew-link).
  return missing;
}

/**
 * Approve a pending connection request via the backend (service_role).
 * Expected endpoint: POST /connection-requests/:id/approve
 */
export async function approveConnectionRequest(
  req: ConnectionRequestRow,
  options: { promoteToReal?: boolean } = {}
): Promise<ApproveConnectionAction> {
  const { promoteToReal = true } = options;
  const res = await postConnectionRequestAction(req.id, "approve", {
    promote_to_real: promoteToReal,
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to approve request"));
  }

  try {
    const data = (await res.json()) as { action?: ApproveConnectionAction };
    if (data.action === "added" || data.action === "updated") return data.action;
  } catch {
    // Backend may return an empty body; treat as successful update.
  }
  return "updated";
}

/**
 * Reject a pending connection request via the backend (service_role).
 * Expected endpoint: POST /connection-requests/:id/reject
 * Body: { reason?: string }
 */
export async function rejectConnectionRequest(
  req: ConnectionRequestRow,
  options: { reason?: string } = {}
): Promise<void> {
  const reason = options.reason?.trim() || undefined;
  const res = await postConnectionRequestAction(req.id, "reject", {
    reason: reason ?? null,
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to reject request"));
  }
}
