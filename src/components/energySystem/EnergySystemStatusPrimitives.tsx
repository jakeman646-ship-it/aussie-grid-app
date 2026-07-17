/**
 * Aussie Grid — Energy system status UI primitives
 * File: src/components/energySystem/EnergySystemStatusPrimitives.tsx
 * Version: v0.1.0
 * Updated: 18 Jul 2026
 *
 * Small presentational pieces shared by OEM status cards (read-only).
 */

export function EnergySystemMetaCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-slate-700/60 bg-slate-950/40 px-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={`mt-1 text-sm font-medium text-slate-100 ${mono ? "truncate font-mono text-xs" : ""}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

export function EnergySystemMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-slate-600/40 bg-black/25 px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-50">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function EnergySystemFieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-black/20 px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="break-all font-mono text-xs text-slate-100 sm:text-right">{value}</span>
    </div>
  );
}
