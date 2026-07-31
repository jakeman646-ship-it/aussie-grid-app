/**
 * Aussie Grid — Connection Health summary (Dashboard)
 * File: src/components/energySystem/ConnectionHealthSummary.tsx
 * Version: v0.3.0
 * Updated: 1 Aug 2026 — Sungrow last-ingest from household_readings; Monitoring label
 *
 * Compact top-level glance above EnergySystemsSection.
 * Read-only — no writes, no control, never invents "connected" from OAuth alone.
 */
import { useLatestReadingAt } from "@/hooks/useLatestReadingAt";
import { useSigenergyStatus } from "@/hooks/useSigenergyStatus";
import type { EnergySystemStatusBaseProps } from "@/types/energySystemStatus";
import {
  detectOemFromInverterMake,
  ENERGY_SYSTEM_STATUS_STYLES,
  energySystemStatusLabel,
  formatEnergyTimestamp,
} from "./statusPresentation";
import { buildEnergySystemsOverviewSummary } from "./overviewSummary";

export type ConnectionHealthSummaryProps = Pick<
  EnergySystemStatusBaseProps,
  "householdId" | "inverterMake" | "customerFacing"
> & {
  /** Real latest household_readings.timestamp from live snapshot when available. */
  lastReadingAt?: string | null;
};

/**
 * Household connection health at a glance — sits above Energy Systems.
 */
export function ConnectionHealthSummary({
  householdId,
  inverterMake = null,
  customerFacing = false,
  lastReadingAt: lastReadingAtProp = null,
}: ConnectionHealthSummaryProps) {
  const {
    status: sigenergyStatus,
    systemId: sigenergySystemId,
    loading: sigenergyLoading,
    lastSuccessAt,
    lastIngest,
  } = useSigenergyStatus(householdId);

  const { lastReadingAt, loading: readingLoading } = useLatestReadingAt(
    householdId,
    lastReadingAtProp,
  );

  const summary = buildEnergySystemsOverviewSummary({
    inverterMake,
    sigenergyStatus,
    sigenergySystemId,
    sigenergyLoading,
    lastReadingAt,
  });

  const oem = detectOemFromInverterMake(inverterMake);
  const sungrowOnly = oem === "sungrow";
  const fromLiveReadings = summary.sungrowMonitoring;

  const overallStyle = ENERGY_SYSTEM_STATUS_STYLES[summary.overall];
  const badgeStatusLabel = energySystemStatusLabel(summary.overall, {
    customerFacing,
    fromLiveReadings: fromLiveReadings && summary.overall === "connected",
  });

  // Sungrow: last successful ingest = latest reading time (not Sigenergy summary).
  const lastIngestAt = sungrowOnly
    ? lastReadingAt
    : lastSuccessAt || lastIngest?.updatedAt || lastReadingAt || null;
  const lastIngestLabel =
    sigenergyLoading || readingLoading
      ? "…"
      : lastIngestAt
        ? formatEnergyTimestamp(lastIngestAt)
        : "No recent data";

  if (summary.checking) {
    return (
      <div
        role="status"
        aria-busy
        aria-label="Connection health"
        className="rounded-xl border border-slate-700/55 bg-slate-900/55 px-4 py-3 shadow-sm shadow-black/15"
      >
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-slate-400" aria-hidden />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500/90">
              Connection Health
            </p>
            <p className="mt-0.5 text-sm text-slate-400">Checking linked energy systems…</p>
          </div>
        </div>
      </div>
    );
  }

  if (summary.visible === 0) {
    return (
      <div
        role="status"
        aria-label="Connection health"
        className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/35 px-4 py-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500/90">
              Connection Health
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {customerFacing
                ? "No energy system connected yet"
                : "No energy systems listed for this household"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {customerFacing
                ? "Connect your inverter to see live status here · monitoring only"
                : "Expand Energy Systems below for setup guidance · monitoring only"}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 ring-1 ring-slate-600/50">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" aria-hidden />
            {customerFacing ? "Not connected" : "Not configured"}
          </span>
        </div>
      </div>
    );
  }

  const badgeLabel = summary.mixed ? "Mixed" : badgeStatusLabel;
  const badgeClass = summary.mixed
    ? "bg-amber-900/50 text-amber-100 ring-1 ring-amber-500/45"
    : overallStyle.badgeClass;
  const badgeDot = summary.mixed ? "bg-amber-400" : overallStyle.dotClass;
  const ringClass = summary.mixed ? "border-amber-600/45" : overallStyle.ringClass;
  const attentionTone =
    summary.needAttention > 0 ? "text-amber-200" : "text-slate-400";

  const connectedPhrase =
    fromLiveReadings && customerFacing
      ? `${summary.connected} monitoring`
      : `${summary.connected} connected`;

  return (
    <div
      role="status"
      aria-label="Connection health"
      className={`rounded-xl border bg-slate-900/60 px-4 py-3 shadow-sm shadow-black/15 ${ringClass}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500/90">
            Connection Health
          </p>
          <p className="mt-1 text-sm font-medium text-slate-100">
            {summary.mixed ? (
              <>
                <span className="tabular-nums text-amber-200">
                  {summary.connected} of {summary.visible} connected
                </span>
                <span className="text-slate-500"> · </span>
                <span className={`tabular-nums ${attentionTone}`}>
                  {summary.needAttention} need attention
                </span>
              </>
            ) : (
              <>
                <span className="tabular-nums text-emerald-300">{connectedPhrase}</span>
                <span className="text-slate-500"> · </span>
                <span className={`tabular-nums ${attentionTone}`}>
                  {summary.needAttention === 0
                    ? "0 need attention"
                    : `${summary.needAttention} need attention`}
                </span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {sungrowOnly ? "Last reading: " : "Last successful ingest: "}
            <span className="tabular-nums text-slate-400">{lastIngestLabel}</span>
            {" · "}
            {fromLiveReadings
              ? "Monitoring · read-only — from live readings, not Accept alone"
              : "monitoring only — never from Accept alone"}
          </p>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${badgeClass}`}
          title={
            summary.mixed
              ? `Mixed statuses — worst: ${overallStyle.label}`
              : fromLiveReadings
                ? "Live household_readings within 2 hours"
                : "Overall household energy-system status"
          }
        >
          <span className={`h-2 w-2 rounded-full ${badgeDot}`} aria-hidden />
          {badgeLabel}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-700/45 pt-3 sm:max-w-lg">
        <div className="rounded-md bg-slate-950/45 px-2.5 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            {fromLiveReadings ? "Monitoring" : "Connected"}
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-300">
            {summary.connected}
          </dd>
        </div>
        <div className="rounded-md bg-slate-950/45 px-2.5 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">Attention</dt>
          <dd
            className={`mt-0.5 text-sm font-semibold tabular-nums ${
              summary.needAttention > 0 ? "text-amber-200" : "text-slate-300"
            }`}
          >
            {summary.needAttention}
          </dd>
        </div>
        <div className="rounded-md bg-slate-950/45 px-2.5 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">Listed</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-200">
            {summary.visible}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default ConnectionHealthSummary;
