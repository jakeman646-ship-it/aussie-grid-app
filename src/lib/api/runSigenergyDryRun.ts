/**
 * Aussie Grid — Sigenergy dry-run validation API
 * File: src/lib/api/runSigenergyDryRun.ts
 * Version: v0.1.1
 * Updated: 18 Jul 2026 — abort timeout for slow OEM responses
 *
 * Calls FastAPI POST /ingest/sigenergy/validate (always dry-run, no writes).
 * Requires VITE_API_URL (same as approve/reject connection requests).
 */

export type SigenergyDryRunVerdict =
  | "pass"
  | "data_not_ready"
  | "fail"
  | "error";

export interface SigenergyDryRunResult {
  ok: boolean;
  verdict: SigenergyDryRunVerdict;
  connected: boolean;
  dry_run: boolean;
  written: boolean;
  message: string;
  household_id: string;
  system_id: string;
  phase: string | null;
  phase_data_present: boolean;
  phase_count: number;
  honest_status: Record<string, unknown>;
}

export interface RunSigenergyDryRunParams {
  householdId: string;
  systemId: string;
  days?: number;
  /** Override default 90s timeout (OEM history can be slow). */
  timeoutMs?: number;
}

/** Default wait for dry-run — long enough for auth + one history day. */
export const SIGENERGY_DRY_RUN_TIMEOUT_MS = 90_000;

function apiBaseUrl(): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!base) {
    throw new Error(
      "VITE_API_URL is not set. Dry-run validation needs the Aussie Grid API.",
    );
  }
  return base.replace(/\/$/, "");
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: string | unknown; message?: string };
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map((d) => JSON.stringify(d)).join("; ");
    }
    if (typeof data.message === "string" && data.message.trim()) return data.message;
  } catch {
    // ignore non-JSON
  }
  return `${fallback} (${res.status})`;
}

/**
 * Trigger a read-only Sigenergy dry-run validation via the backend.
 * Never writes; never claims connected unless the worker reports a usable pull.
 */
export async function runSigenergyDryRun(
  params: RunSigenergyDryRunParams,
): Promise<SigenergyDryRunResult> {
  const householdId = params.householdId.trim();
  const systemId = params.systemId.trim();
  if (!householdId || !systemId) {
    throw new Error("household_id and system_id are required for dry-run validation");
  }

  const days = Math.min(Math.max(params.days ?? 1, 1), 14);
  const timeoutMs = params.timeoutMs ?? SIGENERGY_DRY_RUN_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${apiBaseUrl()}/ingest/sigenergy/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: householdId,
        system_id: systemId,
        days,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(await readErrorMessage(res, "Sigenergy dry-run failed"));
    }

    return (await res.json()) as SigenergyDryRunResult;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        `Dry-run timed out after ${Math.round(timeoutMs / 1000)}s. Check FastAPI is running, then retry or use the CLI fallback.`,
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}
