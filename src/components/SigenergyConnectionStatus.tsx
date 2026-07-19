/**
 * Aussie Grid — Sigenergy Connection Status
 * File: src/components/SigenergyConnectionStatus.tsx
 * Version: v0.7.0
 * Updated: 19 Jul 2026 — customerFacing hides dry-run / CLI / ops docs
 *
 * OEM adapter for Sigenergy. Uses the shared energy-system status shell so
 * Sungrow / Tesla can follow the same pattern later without one-off layouts.
 *
 * Behaviour (unchanged):
 *  - Read-only; never invents "connected" without a usable data pull
 *  - Dry-run via POST /ingest/sigenergy/validate (no writes / no control)
 *  - Refresh Status re-fetches Supabase only
 *  - Overview variant: hide for other OEMs, compact Not configured otherwise
 *  - Dry-run history is session-local (useState only; no persistence)
 */
import { useEffect, useMemo, useState } from "react";
import { useSigenergyStatus } from "@/hooks/useSigenergyStatus";
import {
  runSigenergyDryRun,
  type SigenergyDryRunResult,
  type SigenergyDryRunVerdict,
} from "@/lib/api/runSigenergyDryRun";
import type { EnergySystemStatusBaseProps } from "@/types/energySystemStatus";
import {
  EnergySystemStatusCard,
  EnergySystemStatusChecking,
  EnergySystemStatusCompactNotConfigured,
  EnergySystemMetricCard,
  EnergySystemFieldRow,
  ENERGY_SYSTEM_STATUS_STYLES,
  shouldHideOemCardOnOverview,
  formatEnergyTimestamp,
  formatKwh,
  formatSocPct,
} from "@/components/energySystem";

const OEM_ID = "sigenergy" as const;
const OEM_LABEL = "Sigenergy";

/** Max dry-run attempts kept in session memory (newest first). */
const DRY_RUN_HISTORY_MAX = 5;

export interface SigenergyConnectionStatusProps extends EnergySystemStatusBaseProps {}

/** One completed dry-run attempt (success or caught error). In-memory only. */
interface DryRunHistoryEntry {
  id: string;
  at: number;
  verdict: SigenergyDryRunVerdict;
}

/** OEM-specific blurbs on top of shared badge styles. */
const STATUS_BLURB: Record<"connected" | "data_not_ready" | "not_configured", string> = {
  connected:
    "Aussie Grid has pulled usable Sigenergy day totals (or SOC) for this household. Monitoring only — not agent control.",
  data_not_ready:
    "Sigenergy may be configured, but we do not yet have a successful data pull. Owner Accept or empty history can cause this — we will not mark you connected until data flows.",
  not_configured:
    "No Sigenergy systemId is linked to this household yet. Add a systemId, then run a dry-run check (or use the CLI). Commercial / MM: validate → CTO gate → first live day.",
};

/** Household-facing blurbs (admin impersonation / customer demo). */
const STATUS_BLURB_CUSTOMER: Record<
  "connected" | "data_not_ready" | "not_configured",
  string
> = {
  connected:
    "Your Sigenergy system is linked and we are receiving usable energy data. Monitoring only — the agent is not controlling your system from here.",
  data_not_ready:
    "You're linked and we're preparing the first readings. We only show Connected once live data actually arrives — nothing is wrong.",
  not_configured:
    "Your inverter is not linked for live data yet. Use Connect Inverter if you still need to submit a connection request.",
};

const VERDICT_COPY: Record<
  SigenergyDryRunVerdict,
  {
    label: string;
    title: string;
    hint: string;
    badgeClass: string;
    panelClass: string;
  }
> = {
  pass: {
    label: "PASS",
    title: "Dry-run passed",
    hint: "Usable day totals/SOC in dry-run. Safe to discuss a CTO-gated one-day --live. Monitoring only.",
    badgeClass: "bg-emerald-600/40 text-emerald-100 ring-1 ring-emerald-400/50",
    panelClass: "border-emerald-600/50 bg-emerald-950/35",
  },
  data_not_ready: {
    label: "DATA NOT READY",
    title: "Dry-run: data not ready",
    hint: "Auth/systemId may be fine, but history is empty or Accept is pending. Do not mark connected. Do not --live yet.",
    badgeClass: "bg-amber-700/50 text-amber-100 ring-1 ring-amber-400/40",
    panelClass: "border-amber-600/45 bg-amber-950/30",
  },
  fail: {
    label: "FAIL",
    title: "Dry-run failed",
    hint: "Fix auth, systemId, or network, then retry. Do not --live until PASS.",
    badgeClass: "bg-rose-700/50 text-rose-100 ring-1 ring-rose-400/40",
    panelClass: "border-rose-600/45 bg-rose-950/30",
  },
  error: {
    label: "ERROR",
    title: "Dry-run error",
    hint: "Unexpected worker response. Retry, or use the CLI fallback from aussie-grid-backend.",
    badgeClass: "bg-rose-800/50 text-rose-100 ring-1 ring-rose-500/40",
    panelClass: "border-rose-700/50 bg-rose-950/35",
  },
};

const VALIDATOR_CMD =
  "python ingest/validate_sigenergy.py --household mm-electrical --system-id <SYSTEM_ID>";

const CHECKLIST_NOTE =
  "FIRST_RUN_CHECKLIST.md · FIRST_SIGENERGY_REAL_RUN.md · SIGENERGY_QUICK_COMMANDS.md · SIGENERGY_INGESTION_GUIDELINES.md";

type DayEnergyPeek = {
  summaryDate: string | null;
  solarKwh: number | null;
  importKwh: number | null;
  exportKwh: number | null;
  chargeKwh: number | null;
  dischargeKwh: number | null;
  selfConsumptionKwh: number | null;
  socEndPct: number | null;
  phaseDataPresent: boolean;
  phaseCount: number;
};

function pickHonestField(honest: Record<string, unknown>, key: string): string {
  const v = honest[key];
  if (v == null || v === "") return "—";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Pull first day row's normalised energy for human-readable dry-run metrics. */
function extractDayEnergyPeek(honest: Record<string, unknown>): DayEnergyPeek | null {
  const rows = honest.rows;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const first = rows[0];
  if (!first || typeof first !== "object") return null;
  const row = first as Record<string, unknown>;
  const normalised =
    row.normalised && typeof row.normalised === "object"
      ? (row.normalised as Record<string, unknown>)
      : {};

  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const phaseCount =
    num(normalised.phase_count) ??
    (typeof honest.phase_count === "number" ? honest.phase_count : 0);
  const phasePresent =
    Boolean(normalised.phase_data_present) ||
    Boolean(honest.phase_data_present) ||
    phaseCount > 0;

  return {
    summaryDate: typeof row.summary_date === "string" ? row.summary_date : null,
    solarKwh: num(normalised.solar_kwh),
    importKwh: num(normalised.import_kwh),
    exportKwh: num(normalised.export_kwh),
    chargeKwh: num(normalised.battery_charge_kwh),
    dischargeKwh: num(normalised.battery_discharge_kwh),
    selfConsumptionKwh: num(normalised.self_consumption_kwh),
    socEndPct: num(normalised.soc_end_pct),
    phaseDataPresent: phasePresent,
    phaseCount: phaseCount ?? 0,
  };
}

function formatHistoryTimestamp(at: number): string {
  try {
    return new Date(at).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

function prependDryRunHistory(
  prev: DryRunHistoryEntry[],
  verdict: SigenergyDryRunVerdict,
): DryRunHistoryEntry[] {
  const entry: DryRunHistoryEntry = {
    id: `${Date.now()}-${verdict}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    verdict,
  };
  return [entry, ...prev].slice(0, DRY_RUN_HISTORY_MAX);
}

/**
 * Sigenergy OEM adapter — thin orchestration around EnergySystemStatusCard.
 * Future OEMs: copy this file's structure; swap hook + dry-run API + blurbs.
 */
export function SigenergyConnectionStatus({
  householdId,
  variant = "full",
  inverterMake = null,
  customerFacing = false,
}: SigenergyConnectionStatusProps) {
  const {
    status,
    lastSuccessAt,
    systemId,
    siteType,
    phaseDataPresent,
    usingPlaceholder,
    loading,
    error,
    refetch,
  } = useSigenergyStatus(householdId);

  const [showManualCmd, setShowManualCmd] = useState(false);
  const [showHonestJson, setShowHonestJson] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [statusRefreshing, setStatusRefreshing] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<SigenergyDryRunResult | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [dryRunStartedAt, setDryRunStartedAt] = useState<number | null>(null);
  const [dryRunHistory, setDryRunHistory] = useState<DryRunHistoryEntry[]>([]);

  useEffect(() => {
    if (!loading && statusRefreshing) {
      setStatusRefreshing(false);
    }
  }, [loading, statusRefreshing]);

  const presentation = ENERGY_SYSTEM_STATUS_STYLES[status];
  const blurb = customerFacing ? STATUS_BLURB_CUSTOMER[status] : STATUS_BLURB[status];
  const hasSystemId = Boolean(systemId?.trim());
  const statusBusy = loading || statusRefreshing;
  const canRunApiDryRun = hasSystemId && !dryRunning;
  const canRefreshStatus = !dryRunning && !statusRefreshing;
  const isOverview = variant === "overview";

  const hideForOtherOem = shouldHideOemCardOnOverview({
    variant,
    status,
    hasExternalId: hasSystemId,
    inverterMake,
    oemId: OEM_ID,
  });

  const cmd = useMemo(() => {
    const hh = householdId || "mm-electrical";
    if (systemId) {
      return VALIDATOR_CMD.replace("<SYSTEM_ID>", systemId).replace("mm-electrical", hh);
    }
    return VALIDATOR_CMD.replace("mm-electrical", hh);
  }, [householdId, systemId]);

  const honest = dryRunResult?.honest_status ?? null;
  const honestJson = useMemo(() => {
    if (!honest) return "";
    try {
      return JSON.stringify(honest, null, 2);
    } catch {
      return String(honest);
    }
  }, [honest]);

  const dayPeek = useMemo(
    () => (honest ? extractDayEnergyPeek(honest) : null),
    [honest],
  );

  const honestErrors = Array.isArray(honest?.errors)
    ? (honest!.errors as unknown[]).map(String).filter(Boolean)
    : [];

  const handleCopyCmd = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(true);
      window.setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      setCopiedCmd(false);
    }
  };

  const handleCopyJson = async () => {
    if (!honestJson) return;
    try {
      await navigator.clipboard.writeText(honestJson);
      setCopiedJson(true);
      window.setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      setCopiedJson(false);
    }
  };

  const handleRefreshStatus = () => {
    setStatusRefreshing(true);
    refetch();
  };

  const handleDryRun = async () => {
    if (!systemId?.trim()) {
      setDryRunError(
        "No Sigenergy systemId is configured for this household. Link a systemId first, or use the CLI with a known ID.",
      );
      setDryRunResult(null);
      setShowManualCmd(true);
      return;
    }

    setDryRunning(true);
    setDryRunStartedAt(Date.now());
    setDryRunError(null);
    setDryRunResult(null);
    setShowHonestJson(false);

    try {
      const result = await runSigenergyDryRun({
        householdId,
        systemId,
        days: 1,
      });
      setDryRunResult(result);
      setDryRunHistory((prev) => prependDryRunHistory(prev, result.verdict));
      setStatusRefreshing(true);
      refetch();
    } catch (err) {
      setDryRunError(err instanceof Error ? err.message : "Dry-run request failed");
      setDryRunHistory((prev) => prependDryRunHistory(prev, "error"));
      setShowManualCmd(true);
    } finally {
      setDryRunning(false);
      setDryRunStartedAt(null);
    }
  };

  const verdictUi = dryRunResult ? VERDICT_COPY[dryRunResult.verdict] : null;
  const badgeLoading = statusBusy && !dryRunning;
  const lastLabel = formatEnergyTimestamp(lastSuccessAt);

  // —— Overview early exits (shared helpers) ——
  if (hideForOtherOem) {
    return null;
  }

  if (isOverview && loading && status === "not_configured" && !hasSystemId) {
    return <EnergySystemStatusChecking oemLabel={OEM_LABEL} />;
  }

  if (isOverview && !loading && status === "not_configured" && !hasSystemId) {
    return (
      <EnergySystemStatusCompactNotConfigured
        oemLabel={OEM_LABEL}
        message={
          customerFacing
            ? "Not connected yet — live status appears after your system is linked and data arrives."
            : "Not configured for this household — monitoring only when a systemId is linked."
        }
      />
    );
  }

  const customerMeta = [
    { label: "Last updated", value: statusBusy ? "…" : lastLabel },
    {
      label: "Data status",
      value: statusBusy
        ? "…"
        : status === "connected"
          ? "Receiving data"
          : status === "data_not_ready"
            ? "Preparing first readings"
            : "Not connected",
    },
  ];

  const opsMeta = [
    { label: "Last successful ingest", value: statusBusy ? "…" : lastLabel },
    { label: "System ID", value: systemId || "(not set)", mono: true },
    { label: "Site type", value: statusBusy ? "…" : siteType || "—" },
    {
      label: "Phase data (cloud)",
      value: statusBusy
        ? "…"
        : phaseDataPresent
          ? "Present"
          : "Absent (aggregate only)",
    },
  ];

  return (
    <EnergySystemStatusCard
      oemId={OEM_ID}
      oemLabel={OEM_LABEL}
      presentation={presentation}
      blurb={blurb}
      usingPlaceholder={customerFacing ? false : usingPlaceholder}
      busy={statusBusy || dryRunning}
      badgeLoading={badgeLoading}
      metaBusy={statusBusy}
      metaItems={customerFacing ? customerMeta : opsMeta}
      alerts={
        <>
          {error && (
            <div className="mt-3 rounded-md border border-amber-700/40 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/95">
              {customerFacing
                ? "We could not refresh connection status just now. Showing the last known safe status — not claimed as connected."
                : `Could not refresh live Sigenergy rows (${error}). Showing safe placeholder status — not claimed as connected.`}
            </div>
          )}
          {!customerFacing && !hasSystemId && !statusBusy && (
            <div className="mt-3 rounded-md border border-slate-600/50 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
              <span className="font-medium text-slate-200">No systemId yet.</span> Dry-run via API is
              disabled until a Sigenergy systemId is linked. You can still copy the CLI template below
              once you have an ID.
            </div>
          )}
        </>
      }
      actions={
        <>
          <button
            type="button"
            onClick={handleRefreshStatus}
            disabled={!canRefreshStatus}
            title={
              customerFacing
                ? "Refresh connection status"
                : "Re-fetch stored Sigenergy status from Supabase (does not run dry-run)"
            }
            className="rounded-lg border border-slate-500 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {statusRefreshing
              ? "Refreshing…"
              : customerFacing
                ? "Refresh"
                : "Refresh Status"}
          </button>
          {!customerFacing && (
            <>
              <button
                type="button"
                onClick={() => void handleDryRun()}
                disabled={!canRunApiDryRun || statusRefreshing}
                title={
                  !hasSystemId
                    ? "Configure a systemId first"
                    : dryRunning
                      ? "Validation in progress"
                      : "Run read-only dry-run validation via API"
                }
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {dryRunning ? "Running dry-run…" : "Run dry-run check"}
              </button>
              <button
                type="button"
                onClick={() => setShowManualCmd((v) => !v)}
                disabled={dryRunning}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {showManualCmd ? "Hide CLI fallback" : "Show CLI fallback"}
              </button>
            </>
          )}
        </>
      }
      actionHint={
        customerFacing ? (
          <p className="mt-2 text-[11px] text-slate-500">
            Refresh reloads the latest connection status. Monitoring only — no control from this
            page.
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-slate-500">
            <span className="font-medium text-slate-400">Refresh Status</span> only reloads stored
            connection rows. <span className="font-medium text-slate-400">Run dry-run check</span>{" "}
            calls the API (read-only, no writes).
          </p>
        )
      }
      footer={
        customerFacing ? (
          <p className="text-xs text-slate-500">
            Pilot monitoring only. We never mark you connected without a successful data pull.
          </p>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-slate-500">
              <span className="font-medium text-slate-400">Ops docs (backend/ingest): </span>
              {CHECKLIST_NOTE}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Monitoring / Phase A only. Commercial sites: 4-week read-only before any control
              opt-in. This card never issues control commands.
            </p>
          </>
        )
      }
    >
      {/* —— Status refresh in progress —— */}
      {statusRefreshing && !dryRunning && (
        <div
          className="mt-4 rounded-lg border border-slate-600/50 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
          role="status"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-slate-400" aria-hidden />
            <p className="font-medium text-slate-100">Refreshing status…</p>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {customerFacing
              ? "Loading the latest connection status. Monitoring only — nothing is being written."
              : "Loading latest Sigenergy rows from Supabase. This does not contact Sigenergy cloud or write anything."}
          </p>
        </div>
      )}

      {/* —— Dry-run in progress —— */}
      {!customerFacing && dryRunning && (
        <div
          className="mt-4 rounded-lg border border-sky-700/40 bg-sky-950/25 px-4 py-3 text-sm text-sky-100"
          role="status"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-400" aria-hidden />
            <p className="font-medium text-sky-200">Dry-run in progress</p>
          </div>
          <p className="mt-1.5 text-sky-100/85">
            Contacting FastAPI → Sigenergy (auth + history). This can take up to ~90 seconds. No
            writes, no control.
            {dryRunStartedAt != null && (
              <span className="ml-1 text-sky-300/70">
                Started {new Date(dryRunStartedAt).toLocaleTimeString()}.
              </span>
            )}
          </p>
        </div>
      )}

      {/* —— Dry-run result —— */}
      {!customerFacing && dryRunResult && verdictUi && (
        <div className={`mt-4 rounded-lg border px-4 py-4 text-sm ${verdictUi.panelClass}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-slate-50">{verdictUi.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-200/90">{verdictUi.hint}</p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${verdictUi.badgeClass}`}
            >
              {verdictUi.label}
            </span>
          </div>

          {dryRunResult.message && (
            <p className="mt-3 rounded-md bg-black/25 px-3 py-2 text-sm text-slate-100/95">
              {dryRunResult.message}
            </p>
          )}

          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-300/90">
              Day totals
              {dayPeek?.summaryDate ? (
                <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
                  ({dayPeek.summaryDate})
                </span>
              ) : null}
            </p>
            {dayPeek ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <EnergySystemMetricCard
                  label="Solar"
                  value={formatKwh(dayPeek.solarKwh)}
                  hint="Generation"
                />
                <EnergySystemMetricCard
                  label="Import"
                  value={formatKwh(dayPeek.importKwh)}
                  hint="From grid"
                />
                <EnergySystemMetricCard
                  label="Export"
                  value={formatKwh(dayPeek.exportKwh)}
                  hint="To grid"
                />
                <EnergySystemMetricCard
                  label="Battery SOC (end)"
                  value={formatSocPct(dayPeek.socEndPct)}
                  hint="End of day"
                />
                <EnergySystemMetricCard
                  label="Battery charge"
                  value={formatKwh(dayPeek.chargeKwh)}
                  hint="Into battery"
                />
                <EnergySystemMetricCard
                  label="Battery discharge"
                  value={formatKwh(dayPeek.dischargeKwh)}
                  hint="From battery"
                />
                <EnergySystemMetricCard
                  label="Self-consumption"
                  value={formatKwh(dayPeek.selfConsumptionKwh)}
                />
                <EnergySystemMetricCard
                  label="Phase data"
                  value={
                    dayPeek.phaseDataPresent
                      ? `Present (${dayPeek.phaseCount})`
                      : "Absent"
                  }
                  hint="Cloud usually aggregate-only"
                />
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                No normalised day row in this dry-run result (common when DATA NOT READY or FAIL).
              </p>
            )}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <EnergySystemFieldRow label="phase" value={dryRunResult.phase ?? "—"} />
            <EnergySystemFieldRow label="connected" value={String(dryRunResult.connected)} />
            <EnergySystemFieldRow
              label="written"
              value={`${String(dryRunResult.written)} (must be false)`}
            />
            <EnergySystemFieldRow
              label="phase_data_present"
              value={
                dryRunResult.phase_data_present
                  ? `true (${dryRunResult.phase_count})`
                  : "false (aggregate only)"
              }
            />
            <EnergySystemFieldRow
              label="site_type"
              value={pickHonestField(honest ?? {}, "site_type")}
            />
            <EnergySystemFieldRow
              label="days_ok"
              value={pickHonestField(honest ?? {}, "days_ok")}
            />
            <EnergySystemFieldRow
              label="days_not_ready"
              value={pickHonestField(honest ?? {}, "days_not_ready")}
            />
            <EnergySystemFieldRow
              label="days_failed"
              value={pickHonestField(honest ?? {}, "days_failed")}
            />
          </div>

          {honestErrors.length > 0 && (
            <div className="mt-3 rounded-md border border-rose-800/40 bg-black/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-rose-300/90">
                Worker errors
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-rose-100/90">
                {honestErrors.slice(0, 6).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {dryRunResult.verdict === "data_not_ready" && (
            <p className="mt-3 text-xs leading-relaxed text-amber-100/80">
              Next: confirm owner Accept in mySigen, wait for OEM history, re-run dry-run. See{" "}
              <span className="font-mono text-[11px]">SIGENERGY_QUICK_COMMANDS.md</span>.
            </p>
          )}

          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHonestJson((v) => !v)}
                className="rounded-md border border-slate-500/50 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-black/20"
                aria-expanded={showHonestJson}
              >
                {showHonestJson ? "Hide full honest_status" : "Show full honest_status JSON"}
              </button>
              {showHonestJson && (
                <button
                  type="button"
                  onClick={() => void handleCopyJson()}
                  className="rounded-md border border-slate-500/50 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-black/20"
                >
                  {copiedJson ? "Copied JSON" : "Copy JSON"}
                </button>
              )}
            </div>
            {showHonestJson && (
              <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-slate-950/80 p-3 text-[11px] leading-relaxed text-slate-200">
                {honestJson || "(empty)"}
              </pre>
            )}
          </div>
        </div>
      )}

      {!customerFacing && dryRunError && !dryRunning && (
        <div className="mt-4 rounded-lg border border-rose-700/45 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-rose-200">Could not complete dry-run</p>
            <span className="rounded-full bg-rose-800/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-100 ring-1 ring-rose-500/40">
              Error
            </span>
          </div>
          <p className="mt-1.5 opacity-95">{dryRunError}</p>
          <p className="mt-2 text-xs text-rose-200/75">
            Check <code className="text-rose-100">VITE_API_URL</code> and that FastAPI is running (
            <code className="text-rose-100">python main.py</code>). Use the CLI fallback if the API
            is unavailable.
          </p>
        </div>
      )}

      {/* —— Dry-run history (session memory, last 5) —— */}
      {!customerFacing && (
        <div className="mt-4 rounded-lg border border-slate-700/60 bg-slate-950/35 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Dry-run history
            </p>
            <p className="text-[11px] text-slate-500">
              Last {DRY_RUN_HISTORY_MAX} · this session only
            </p>
          </div>
          {dryRunHistory.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No dry-run attempts yet</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-800/80" role="list">
              {dryRunHistory.map((entry) => {
                const copy = VERDICT_COPY[entry.verdict];
                return (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <span className="text-xs tabular-nums text-slate-300">
                      {formatHistoryTimestamp(entry.at)}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${copy.badgeClass}`}
                    >
                      {copy.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {!customerFacing && showManualCmd && (
        <div className="mt-4 rounded-lg border border-sky-700/40 bg-sky-950/20 px-4 py-3 text-sm text-sky-100/90">
          <p className="font-medium text-sky-300">Manual dry-run (CLI fallback)</p>
          <p className="mt-1 text-sky-100/80">
            Same path as the API — run from{" "}
            <code className="text-xs text-sky-200">aussie-grid-backend</code>. Always dry-run; never
            marks connected without a real data pull.
          </p>
          {!hasSystemId && (
            <p className="mt-1 text-xs text-amber-200/90">
              Replace <code className="text-amber-100">&lt;SYSTEM_ID&gt;</code> with the real ID from
              mySigen → Settings → Basic Info.
            </p>
          )}
          <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950/70 p-3 text-xs text-slate-200">
            {cmd}
          </pre>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCopyCmd()}
              className="rounded-md border border-sky-600/50 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-900/40"
            >
              {copiedCmd ? "Copied" : "Copy command"}
            </button>
          </div>
        </div>
      )}
    </EnergySystemStatusCard>
  );
}

export default SigenergyConnectionStatus;
