/**
 * Aussie Grid — Last ingest summary (Energy Systems section)
 * File: src/components/energySystem/LastIngestSummary.tsx
 * Version: v0.2.0
 * Updated: 18 Jul 2026 — compact header glance + expanded full strip
 *
 * Compact read-only metrics from the latest successful daily_system_summary pull.
 * Header glance: 3 key kWh figures for the always-visible summary.
 * Expanded strip: full day totals (unchanged behaviour).
 * Does not call OEM APIs.
 */
import type { SigenergyLastIngest } from "@/hooks/useSigenergyStatus";
import { formatEnergyTimestamp, formatKwh, formatSocPct } from "./statusPresentation";

function MetricCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-slate-700/50 bg-slate-950/50 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-100">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-slate-600">{hint}</p> : null}
    </div>
  );
}

function selfConsumptionDisplay(ingest: SigenergyLastIngest): string {
  if (ingest.selfConsumptionKwh != null) {
    return formatKwh(ingest.selfConsumptionKwh);
  }
  // Soft derived % when we have solar + self is missing but import/export exist — skip invention.
  return "—";
}

/** Compact kWh for header — drop unit suffix noise when value is blank. */
function formatHeaderKwh(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(1);
}

/**
 * Always-visible header strip: Solar / Import / Export (or clean fallback).
 * Stays scannable — no cards, no SOC/self-consumption (those stay in expanded view).
 */
export function LastIngestHeaderGlance({
  lastIngest,
  loading,
}: {
  lastIngest: SigenergyLastIngest | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-3 border-t border-slate-700/40 pt-3" aria-busy>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Last ingest
        </p>
        <p className="mt-1 text-[11px] text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!lastIngest) {
    return (
      <div className="mt-3 border-t border-slate-700/40 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Last ingest
        </p>
        <p className="mt-1 text-[11px] text-slate-500">No recent data</p>
      </div>
    );
  }

  const metrics = [
    { key: "solar", label: "Solar", value: formatHeaderKwh(lastIngest.solarKwh) },
    { key: "import", label: "Import", value: formatHeaderKwh(lastIngest.importKwh) },
    { key: "export", label: "Export", value: formatHeaderKwh(lastIngest.exportKwh) },
  ] as const;

  return (
    <div className="mt-3 border-t border-slate-700/40 pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Last ingest
        </p>
        <p className="text-[10px] text-slate-600">kWh · latest day</p>
      </div>
      <dl className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {metrics.map((m) => (
          <div key={m.key} className="inline-flex items-baseline gap-1.5">
            <dt className="text-[10px] uppercase tracking-wide text-slate-500">{m.label}</dt>
            <dd className="text-sm font-semibold tabular-nums text-slate-200">{m.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LastIngestSummary({
  lastIngest,
  loading,
}: {
  lastIngest: SigenergyLastIngest | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-700/50 bg-slate-950/30 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Last ingest summary
        </p>
        <p className="mt-1.5 text-xs text-slate-500">Loading latest day totals…</p>
      </div>
    );
  }

  if (!lastIngest) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700/60 bg-slate-950/30 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Last ingest summary
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          No recent data — full day totals appear after the first successful Sigenergy
          cloud pull (dry-run or live). Key metrics also show in the section header when
          available.
        </p>
      </div>
    );
  }

  const when =
    lastIngest.summaryDate ||
    (lastIngest.updatedAt ? formatEnergyTimestamp(lastIngest.updatedAt) : null);

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-950/30 px-3 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Last ingest summary
        </p>
        <p className="text-[10px] text-slate-500">
          {when ? `Day ${when}` : "Latest pull"}
          {lastIngest.source ? ` · ${lastIngest.source}` : ""}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCell label="Solar" value={formatKwh(lastIngest.solarKwh)} hint="Generation" />
        <MetricCell label="Import" value={formatKwh(lastIngest.importKwh)} hint="From grid" />
        <MetricCell label="Export" value={formatKwh(lastIngest.exportKwh)} hint="To grid" />
        <MetricCell
          label="Self-consumption"
          value={selfConsumptionDisplay(lastIngest)}
          hint="kWh"
        />
        <MetricCell
          label="Battery SOC"
          value={formatSocPct(lastIngest.batterySocEnd)}
          hint="End of day"
        />
      </div>
    </div>
  );
}
