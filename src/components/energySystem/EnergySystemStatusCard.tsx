/**
 * Aussie Grid — EnergySystemStatusCard (base shell)
 * File: src/components/energySystem/EnergySystemStatusCard.tsx
 * Version: v0.1.0
 * Updated: 18 Jul 2026
 *
 * Presentational shell for OEM energy-system status cards.
 * Adapters supply status + meta + action slots; this component never
 * calls OEM APIs or writes data (read-only / monitoring only).
 *
 * How to add a new OEM (e.g. Sungrow, Tesla):
 *  1. Add oemId to EnergySystemOemId in types/energySystemStatus.ts
 *  2. Create `SungrowConnectionStatus.tsx` (or Tesla…) that:
 *     - loads status via an OEM hook (honest connected / data_not_ready / not_configured)
 *     - uses shouldHideOemCardOnOverview for Dashboard placement
 *     - renders <EnergySystemStatusCard …> with OEM-specific actions/children
 *  3. Mount the adapter inside EnergySystemsSection (overview variant)
 */

import type { ReactNode } from "react";
import type {
  EnergySystemMetaItem,
  EnergySystemOemId,
  EnergySystemStatusPresentation,
} from "@/types/energySystemStatus";
import { EnergySystemMetaCell } from "./EnergySystemStatusPrimitives";

export interface EnergySystemStatusCardProps {
  oemId: EnergySystemOemId;
  oemLabel: string;
  /** Defaults to "{oemLabel} connection status". */
  title?: string;
  presentation: EnergySystemStatusPresentation;
  blurb: string;
  metaItems: EnergySystemMetaItem[];
  /** Soften meta grid while a status refresh is in flight. */
  metaBusy?: boolean;
  /** Pulse badge + show "Refreshing…". */
  badgeLoading?: boolean;
  usingPlaceholder?: boolean;
  busy?: boolean;
  ariaLabel?: string;
  /** Optional alerts under the meta grid (errors, missing id, etc.). */
  alerts?: ReactNode;
  /** Action row (Refresh, dry-run, CLI toggle, OAuth, …). */
  actions?: ReactNode;
  /** Short hint under actions. */
  actionHint?: ReactNode;
  /** Progress banners, dry-run results, CLI panels, JSON expanders. */
  children?: ReactNode;
  footer?: ReactNode;
}

/**
 * Full status card shell — shared layout for all OEM adapters.
 */
export function EnergySystemStatusCard({
  oemId,
  oemLabel,
  title,
  presentation,
  blurb,
  metaItems,
  metaBusy = false,
  badgeLoading = false,
  usingPlaceholder = false,
  busy = false,
  ariaLabel,
  alerts,
  actions,
  actionHint,
  children,
  footer,
}: EnergySystemStatusCardProps) {
  const heading = title ?? `${oemLabel} connection status`;

  return (
    <section
      data-oem={oemId}
      aria-label={ariaLabel ?? heading}
      aria-busy={busy}
      className={`rounded-lg border bg-slate-900/50 px-5 py-5 ${presentation.ringClass}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-emerald-400">{heading}</h2>
            {usingPlaceholder && (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 ring-1 ring-slate-600/60">
                Placeholder
              </span>
            )}
            <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-slate-700/60">
              Read-only
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{blurb}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide ${presentation.badgeClass}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${presentation.dotClass} ${badgeLoading ? "animate-pulse" : ""}`}
            aria-hidden
          />
          {badgeLoading ? "Refreshing…" : presentation.label}
        </span>
      </div>

      {metaItems.length > 0 && (
        <dl
          className={`mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${metaBusy ? "opacity-70" : ""}`}
        >
          {metaItems.map((item) => (
            <EnergySystemMetaCell
              key={item.label}
              label={item.label}
              value={item.value}
              mono={item.mono}
            />
          ))}
        </dl>
      )}

      {alerts}

      {actions ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-700/50 pt-4">
          {actions}
        </div>
      ) : null}
      {actionHint}

      {children}

      {footer ? (
        <div className="mt-5 border-t border-slate-700/40 pt-3">{footer}</div>
      ) : null}
    </section>
  );
}

/** Compact Dashboard strip while OEM relevance is still loading. */
export function EnergySystemStatusChecking({ oemLabel }: { oemLabel: string }) {
  return (
    <section
      aria-label={`${oemLabel} connection status loading`}
      aria-busy
      className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-4 py-3"
    >
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-slate-500" aria-hidden />
        Checking {oemLabel} status…
      </div>
    </section>
  );
}

/** Compact “Not configured” strip for overview when this OEM is not linked. */
export function EnergySystemStatusCompactNotConfigured({
  oemLabel,
  message,
}: {
  oemLabel: string;
  message?: string;
}) {
  return (
    <section
      aria-label={`${oemLabel} connection status`}
      className="rounded-lg border border-slate-700/70 bg-slate-900/50 px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-emerald-400">{oemLabel}</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {message ??
              `Not configured for this household — monitoring only when this ${oemLabel} site is linked.`}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-300 ring-1 ring-slate-600/50">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" aria-hidden />
          Not configured
        </span>
      </div>
    </section>
  );
}
