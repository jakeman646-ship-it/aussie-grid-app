/**
 * Aussie Grid — Energy Systems section (Dashboard overview)
 * File: src/components/energySystem/EnergySystemsSection.tsx
 * Version: v0.11.0
 * Updated: 1 Aug 2026 — Sungrow monitoring from household_readings; hide Sigenergy empty for Sungrow
 *
 * Clean household overview wrapper for OEM status adapters.
 * Mounts Sigenergy today; Sungrow stub (and future Tesla) sit beside it
 * using the same EnergySystemStatusCard pattern.
 *
 * Read-only / monitoring only — never invents "connected".
 * Quick actions call dry-run validate only (no writes / no control).
 * `customerFacing` (admin impersonation) hides stubs, docs, and dry-run tools.
 */
import { useMemo, useState } from "react";
import { SigenergyConnectionStatus } from "@/components/SigenergyConnectionStatus";
import { SungrowConnectionStatus } from "@/components/SungrowConnectionStatus";
import { useLatestReadingAt } from "@/hooks/useLatestReadingAt";
import { useSigenergyStatus } from "@/hooks/useSigenergyStatus";
import {
  runSigenergyDryRun,
  type SigenergyDryRunVerdict,
} from "@/lib/api/runSigenergyDryRun";
import type {
  EnergySystemConnectionStatus,
  EnergySystemOemId,
  EnergySystemStatusBaseProps,
} from "@/types/energySystemStatus";
import {
  detectOemFromInverterMake,
  ENERGY_SYSTEM_STATUS_STYLES,
  energySystemStatusLabel,
  formatEnergyTimestamp,
  shouldHideOemCardOnOverview,
} from "./statusPresentation";
import {
  buildEnergySystemsOverviewSummary,
  type EnergySystemsOverviewSummary as OverviewSummary,
} from "./overviewSummary";
import { LastIngestHeaderGlance, LastIngestSummary } from "./LastIngestSummary";
import { EnergySystemsEmptyState } from "./EnergySystemsEmptyState";

export type EnergySystemsSectionProps = Pick<
  EnergySystemStatusBaseProps,
  "householdId" | "inverterMake" | "customerFacing"
> & {
  /** Real latest household_readings.timestamp from live snapshot when available. */
  lastReadingAt?: string | null;
};

/** Per-OEM chip after a section-level validation run (dry-run only). */
type ValidationFeedback = {
  oemId: EnergySystemOemId;
  oemLabel: string;
  verdict: SigenergyDryRunVerdict | "error" | "skipped" | "pending";
  message: string;
};

type ValidationTarget = {
  oemId: EnergySystemOemId;
  oemLabel: string;
  /** True when this section can invoke a dry-run API for the OEM. */
  canValidate: boolean;
  systemId?: string | null;
  skipReason?: string;
};

const VERDICT_BADGE: Record<
  ValidationFeedback["verdict"],
  { label: string; className: string }
> = {
  pass: {
    label: "PASS",
    className: "bg-emerald-600/40 text-emerald-100 ring-1 ring-emerald-400/50",
  },
  data_not_ready: {
    label: "DATA NOT READY",
    className: "bg-amber-700/50 text-amber-100 ring-1 ring-amber-400/40",
  },
  fail: {
    label: "FAIL",
    className: "bg-rose-700/50 text-rose-100 ring-1 ring-rose-400/40",
  },
  error: {
    label: "ERROR",
    className: "bg-rose-800/50 text-rose-100 ring-1 ring-rose-500/40",
  },
  skipped: {
    label: "SKIPPED",
    className: "bg-slate-700/50 text-slate-200 ring-1 ring-slate-500/40",
  },
  pending: {
    label: "RUNNING…",
    className: "bg-sky-800/50 text-sky-100 ring-1 ring-sky-500/40",
  },
};

function formatSummaryTitle(summary: OverviewSummary): string {
  if (summary.checking && summary.connected === 0 && summary.notReady === 0) {
    return "Energy Systems";
  }
  if (summary.visible === 0) {
    return "Energy Systems (0 connected)";
  }
  if (summary.mixed) {
    return `Energy Systems (${summary.connected} of ${summary.visible} connected)`;
  }
  return `Energy Systems (${summary.connected} connected)`;
}

function formatSummaryDetail(
  summary: OverviewSummary,
  customerFacing = false,
): string {
  if (summary.checking) {
    return "Checking linked systems…";
  }
  if (customerFacing) {
    if (summary.sungrowMonitoring) {
      return "Live readings are flowing from your Sungrow system. Monitoring · read-only — not agent control.";
    }
    if (summary.visible === 0 || summary.configured === 0) {
      return "Connect your inverter to see live connection status here.";
    }
    if (summary.mixed) {
      return "Some systems still need data before we can show full status.";
    }
    if (summary.connected > 0) {
      return "Live data is flowing for your linked system. Monitoring · read-only — not agent control.";
    }
    return "Waiting for the first successful data pull before we mark you connected.";
  }
  if (summary.visible === 0) {
    return "No linked OEM for this household yet — expand for setup guidance.";
  }
  if (summary.configured === 0) {
    return `${summary.visible} system${summary.visible === 1 ? "" : "s"} listed · none configured with a data path yet.`;
  }

  if (summary.mixed) {
    const bits: string[] = [];
    if (summary.connected > 0) bits.push(`${summary.connected} connected`);
    if (summary.notReady > 0) bits.push(`${summary.notReady} data not ready`);
    if (summary.notConfigured > 0) bits.push(`${summary.notConfigured} not configured`);
    return `Mixed health — ${bits.join(" · ")}. Expand for per-OEM detail.`;
  }

  const parts: string[] = [`${summary.visible} system${summary.visible === 1 ? "" : "s"} listed`];
  if (summary.notReady > 0) {
    parts.push(`${summary.notReady} data not ready`);
  }
  if (summary.notConfigured > 0) {
    parts.push(`${summary.notConfigured} not configured`);
  }
  if (summary.connected === summary.visible && summary.visible > 0) {
    parts.push("usable data pull confirmed");
  }
  return `${parts.join(" · ")}. Monitoring only — not agent control.`;
}

/** Header badge: surface Mixed when buckets disagree; else worst honest status. */
function resolveOverallBadge(summary: OverviewSummary): {
  label: string;
  badgeClass: string;
  dotClass: string;
  title: string;
} {
  if (summary.checking) {
    return {
      label: "Checking…",
      badgeClass: ENERGY_SYSTEM_STATUS_STYLES.not_configured.badgeClass,
      dotClass: "animate-pulse bg-slate-400",
      title: "Still loading linked energy systems",
    };
  }
  if (summary.mixed) {
    const worst = ENERGY_SYSTEM_STATUS_STYLES[summary.overall];
    return {
      label: "Mixed",
      badgeClass:
        "bg-amber-900/50 text-amber-100 ring-1 ring-amber-500/45 ring-offset-0",
      dotClass: "bg-amber-400",
      title: `Mixed statuses across systems — worst: ${worst.label}`,
    };
  }
  const style = ENERGY_SYSTEM_STATUS_STYLES[summary.overall];
  return {
    label: energySystemStatusLabel(summary.overall, {
      fromLiveReadings: summary.sungrowMonitoring && summary.overall === "connected",
    }),
    badgeClass: style.badgeClass,
    dotClass: style.dotClass,
    title: summary.sungrowMonitoring
      ? "Live household_readings within 2 hours"
      : "Worst status across listed energy systems",
  };
}

/**
 * Systems that appear in the overview + whether this section can dry-run them.
 * Extensible: add Tesla when a dry-run API exists. Does not touch OEM adapters.
 */
function buildValidationTargets(opts: {
  inverterMake: string | null | undefined;
  sigenergySystemId: string | null;
  sigenergyStatus: EnergySystemConnectionStatus;
}): ValidationTarget[] {
  const targets: ValidationTarget[] = [];
  const hasSigenergyId = Boolean(opts.sigenergySystemId?.trim());
  const hideSigenergy = shouldHideOemCardOnOverview({
    variant: "overview",
    status: opts.sigenergyStatus,
    hasExternalId: hasSigenergyId,
    inverterMake: opts.inverterMake,
    oemId: "sigenergy",
  });

  if (!hideSigenergy) {
    targets.push({
      oemId: "sigenergy",
      oemLabel: "Sigenergy",
      canValidate: hasSigenergyId,
      systemId: opts.sigenergySystemId,
      skipReason: hasSigenergyId
        ? undefined
        : "No systemId linked — dry-run unavailable until configured",
    });
  }

  const detected = detectOemFromInverterMake(opts.inverterMake);
  const hideSungrow = shouldHideOemCardOnOverview({
    variant: "overview",
    status: "not_configured",
    hasExternalId: false,
    inverterMake: opts.inverterMake,
    oemId: "sungrow",
  });
  // Sungrow stub card only shows for clear Sungrow homes (adapter behaviour).
  if (!hideSungrow && detected === "sungrow") {
    targets.push({
      oemId: "sungrow",
      oemLabel: "Sungrow",
      canValidate: false,
      skipReason: "Dry-run not implemented yet (stub OEM)",
    });
  }

  return targets;
}

/**
 * Dashboard “Energy Systems” block — multi-OEM ready, overview variant.
 */
export function EnergySystemsSection({
  householdId,
  inverterMake = null,
  customerFacing = false,
  lastReadingAt: lastReadingAtProp = null,
}: EnergySystemsSectionProps) {
  const {
    status: sigenergyStatus,
    systemId: sigenergySystemId,
    loading: sigenergyLoading,
    lastSuccessAt,
    lastIngest,
    refetch: refetchSigenergy,
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

  const validationTargets = useMemo(
    () =>
      buildValidationTargets({
        inverterMake,
        sigenergySystemId,
        sigenergyStatus,
      }),
    [inverterMake, sigenergySystemId, sigenergyStatus],
  );

  const validatableTargets = validationTargets.filter((t) => t.canValidate);
  const validatableCount = validatableTargets.length;

  const title = customerFacing
    ? summary.connected > 0 || summary.sungrowMonitoring
      ? "Your energy system"
      : "Energy system"
    : formatSummaryTitle(summary);
  const detail = formatSummaryDetail(summary, customerFacing);
  const overallStyle = ENERGY_SYSTEM_STATUS_STYLES[summary.overall];
  const overallBadge = resolveOverallBadge(summary);

  // Sungrow: readings time. Else Sigenergy summary, then readings fallback.
  const lastIngestAt = sungrowOnly
    ? lastReadingAt
    : lastSuccessAt || lastIngest?.updatedAt || lastReadingAt || null;
  const lastIngestHeaderLabel =
    sigenergyLoading || readingLoading
      ? customerFacing
        ? "Last updated: …"
        : "Last ingest: …"
      : lastIngestAt
        ? `${customerFacing || sungrowOnly ? "Last reading" : "Last ingest"}: ${formatEnergyTimestamp(lastIngestAt)}`
        : sungrowOnly
          ? "Waiting on next reading"
          : "No recent data";

  const [expanded, setExpanded] = useState(true);
  const [validating, setValidating] = useState(false);
  const [activeOemLabel, setActiveOemLabel] = useState<string | null>(null);
  const [validationFeedback, setValidationFeedback] = useState<ValidationFeedback[] | null>(
    null,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  /**
   * Dry-run every target that supports validation; emit chips for all listed systems
   * (including skipped OEMs) so multi-system households get clear per-OEM feedback.
   */
  const handleValidateAllConfigured = async () => {
    if (validationTargets.length === 0) {
      setValidationError("No energy systems listed for this household yet.");
      setValidationFeedback(null);
      return;
    }

    if (validatableCount === 0) {
      // Still show per-system chips so the user sees why nothing ran.
      setValidationError(null);
      setValidationFeedback(
        validationTargets.map((t) => ({
          oemId: t.oemId,
          oemLabel: t.oemLabel,
          verdict: "skipped" as const,
          message: t.skipReason || "Dry-run not available for this system",
        })),
      );
      return;
    }

    setValidating(true);
    setValidationError(null);
    setActiveOemLabel(null);

    // Pending chips for every listed system (scannable multi-OEM feedback).
    const initial: ValidationFeedback[] = validationTargets.map((t) =>
      t.canValidate
        ? {
            oemId: t.oemId,
            oemLabel: t.oemLabel,
            verdict: "pending",
            message: "Queued for dry-run…",
          }
        : {
            oemId: t.oemId,
            oemLabel: t.oemLabel,
            verdict: "skipped",
            message: t.skipReason || "Dry-run not available for this system",
          },
    );
    setValidationFeedback(initial);

    const next = [...initial];

    const setChip = (oemId: EnergySystemOemId, patch: Partial<ValidationFeedback>) => {
      const idx = next.findIndex((c) => c.oemId === oemId);
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...patch };
        setValidationFeedback([...next]);
      }
    };

    try {
      for (const target of validatableTargets) {
        setActiveOemLabel(target.oemLabel);
        setChip(target.oemId, {
          verdict: "pending",
          message: "Dry-run in progress (read-only)…",
        });

        if (target.oemId === "sigenergy" && target.systemId?.trim()) {
          try {
            const result = await runSigenergyDryRun({
              householdId,
              systemId: target.systemId,
              days: 1,
            });
            setChip(target.oemId, {
              verdict: result.verdict,
              message: result.message || `Dry-run ${result.verdict}`,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : "Dry-run validation failed";
            setChip(target.oemId, { verdict: "error", message });
          }
        } else {
          // Future OEM dry-run hooks register here — still dry-run only.
          setChip(target.oemId, {
            verdict: "skipped",
            message: target.skipReason || "No dry-run handler registered",
          });
        }
      }

      // Refresh stored Sigenergy status only — does not change OEM card UI behaviour.
      if (validatableTargets.some((t) => t.oemId === "sigenergy")) {
        refetchSigenergy();
      }
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setActiveOemLabel(null);
      setValidating(false);
    }
  };

  const validateDisabled = validating || summary.checking;
  const primaryLabel = validating
    ? activeOemLabel
      ? `Validating ${activeOemLabel}…`
      : "Validating…"
    : "Run Validation";

  const validateTitle =
    validatableCount === 0
      ? "No system ready for dry-run — chips will show why each OEM was skipped"
      : validating
        ? "Dry-run in progress (read-only, no writes)"
        : "Run read-only dry-run for every configured system that supports validation";

  /** No usable data path yet — show setup guidance (does not affect configured homes). */
  // Hide Sigenergy "Preparing / Accept" empty-state for Sungrow-only homes.
  const showEmptyGuidance =
    !summary.checking &&
    summary.configured === 0 &&
    !sungrowOnly &&
    !summary.sungrowMonitoring;
  const emptyVariant = summary.visible === 0 ? "full" : "compact";

  const sectionRingClass = summary.mixed
    ? "border-amber-600/45"
    : overallStyle.ringClass;

  return (
    <section
      className={`group/energy-systems overflow-hidden rounded-xl border bg-slate-900/55 shadow-sm shadow-black/20 ${sectionRingClass}`}
      aria-labelledby="energy-systems-heading"
    >
      {/* Summary header — always visible (collapsed or expanded) */}
      <header
        className={`bg-gradient-to-b from-slate-900/90 to-slate-950/40 px-4 py-4 sm:px-5 sm:py-5 ${
          expanded ? "border-b border-slate-700/60" : ""
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500/90">
                Household overview
              </p>
              {summary.mixed ? (
                <span className="inline-flex items-center gap-1 rounded bg-amber-950/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200/90 ring-1 ring-amber-700/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                  Needs attention
                </span>
              ) : null}
            </div>
            <h2
              id="energy-systems-heading"
              className="mt-1 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl"
            >
              {title}
            </h2>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-sm">
              Read-only connection status for linked inverters and batteries. Connected
              only after a usable data pull — never from Accept or OAuth alone.
            </p>
            <p
              className={`mt-2 text-xs ${
                summary.mixed ? "font-medium text-amber-200/85" : "text-slate-500"
              }`}
            >
              {detail}
            </p>
          </div>

          <div className="flex shrink-0 items-start gap-2">
            <div className="flex flex-col items-end gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${overallBadge.badgeClass}`}
                title={overallBadge.title}
              >
                <span
                  className={`h-2 w-2 rounded-full ${overallBadge.dotClass}`}
                  aria-hidden
                />
                {overallBadge.label}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-800/80 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-slate-700/60">
                Monitoring · read-only
              </span>
              <p
                className="max-w-[14rem] text-right text-[11px] tabular-nums text-slate-500"
                title="Timestamp of the last successful energy-system data pull"
              >
                {lastIngestHeaderLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls="energy-systems-panel"
              title={expanded ? "Collapse energy systems details" : "Expand energy systems details"}
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-600/70 bg-slate-800/50 text-slate-300 transition-colors hover:bg-slate-700/70 hover:text-slate-100"
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="sr-only">{expanded ? "Collapse" : "Expand"} Energy Systems</span>
            </button>
          </div>
        </div>

        {/* Compact count strip — ops view only (hidden when impersonating) */}
        {!customerFacing && summary.visible > 0 && !summary.checking ? (
          <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-700/50 pt-3 sm:max-w-md">
            <div
              className={`rounded-md px-2.5 py-2 ${
                summary.connected > 0
                  ? "bg-emerald-950/35 ring-1 ring-emerald-700/35"
                  : "bg-slate-950/50 opacity-60"
              }`}
            >
              <dt className="text-[10px] uppercase tracking-wide text-slate-500">Connected</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-300">
                {summary.connected}
              </dd>
            </div>
            <div
              className={`rounded-md px-2.5 py-2 ${
                summary.notReady > 0
                  ? "bg-amber-950/40 ring-1 ring-amber-700/40"
                  : "bg-slate-950/50 opacity-60"
              }`}
            >
              <dt className="text-[10px] uppercase tracking-wide text-slate-500">Not ready</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-amber-200">
                {summary.notReady}
              </dd>
            </div>
            <div
              className={`rounded-md px-2.5 py-2 ${
                summary.notConfigured > 0
                  ? "bg-slate-800/60 ring-1 ring-slate-600/50"
                  : "bg-slate-950/50 opacity-60"
              }`}
            >
              <dt className="text-[10px] uppercase tracking-wide text-slate-500">Not configured</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-300">
                {summary.notConfigured}
              </dd>
            </div>
          </dl>
        ) : null}

        {/* Compact last-ingest metrics — always visible with summary */}
        {!sungrowOnly && (
          <LastIngestHeaderGlance lastIngest={lastIngest} loading={sigenergyLoading} />
        )}
        {sungrowOnly && (
          <div className="mt-3 border-t border-slate-700/40 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Last reading
            </p>
            <p className="mt-1 text-[11px] tabular-nums text-slate-400">
              {readingLoading
                ? "…"
                : lastReadingAt
                  ? formatEnergyTimestamp(lastReadingAt)
                  : "Waiting on next reading"}
            </p>
            {summary.sungrowMonitoring ? (
              <p className="mt-0.5 text-[11px] text-emerald-400/80">
                Monitoring · read-only from live Sungrow readings
              </p>
            ) : null}
          </div>
        )}

        {!expanded && (
          <p className="mt-3 text-[11px] text-slate-500">
            {customerFacing
              ? "Collapsed — expand for connection details and recent energy totals."
              : "Collapsed — expand for full day totals, OEM cards, and dry-run validation."}
            {!customerFacing && validating
              ? " Validation still running in the background."
              : ""}
          </p>
        )}
      </header>

      {/* Details panel — quick actions + OEM cards (hidden when collapsed) */}
      {expanded && (
        <div id="energy-systems-panel">
          {!customerFacing && (
            <div className="border-b border-slate-700/50 bg-slate-950/20 px-4 py-3 sm:px-5">
              {/* Quick actions — dry-run only; does not alter OEM cards */}
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Quick actions
                </p>
                <button
                  type="button"
                  onClick={() => void handleValidateAllConfigured()}
                  disabled={validateDisabled}
                  title={validateTitle}
                  aria-label="Run Validation for configured energy systems"
                  className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {primaryLabel}
                </button>
                {validatableCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleValidateAllConfigured()}
                    disabled={validateDisabled}
                    title="Same dry-run path — runs every OEM that supports validation"
                    className="rounded-lg border border-slate-500 bg-slate-800/60 px-3.5 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Validate All Configured
                    {validatableCount > 1 ? ` (${validatableCount})` : ""}
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Dry-run only (no writes, no control). Results show as per-system chips. Sigenergy
                validates today; Sungrow / Tesla show Skipped until their dry-run path exists.
              </p>

              {validating && (
                <div
                  className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-sky-700/40 bg-sky-950/25 px-3 py-2 text-xs text-sky-100"
                  role="status"
                >
                  <span
                    className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-400"
                    aria-hidden
                  />
                  <span>
                    {activeOemLabel
                      ? `Validating ${activeOemLabel} (auth + history, up to ~90s)…`
                      : "Starting dry-run validation…"}
                  </span>
                  <span className="text-sky-300/70">
                    {validatableCount} configured · {validationTargets.length} listed
                  </span>
                </div>
              )}

              {validationFeedback && validationFeedback.length > 0 && (
                <div className="mt-3" role="status">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Per-system results
                  </p>
                  <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {validationFeedback.map((item) => {
                      const badge = VERDICT_BADGE[item.verdict];
                      return (
                        <li
                          key={item.oemId}
                          className="flex min-w-[12rem] flex-1 flex-wrap items-start justify-between gap-2 rounded-md border border-slate-700/50 bg-slate-950/40 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-200">{item.oemLabel}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                              {item.message}
                            </p>
                          </div>
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className} ${
                              item.verdict === "pending" ? "animate-pulse" : ""
                            }`}
                          >
                            {badge.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {validationError && !validating && (
                <p className="mt-2 text-xs text-rose-300/90" role="alert">
                  {validationError}
                </p>
              )}
            </div>
          )}

          {/* Sigenergy day totals — skip for Sungrow-only (avoids "No recent data" noise). */}
          {!sungrowOnly && (
            <div className="border-b border-slate-700/50 bg-slate-950/25 px-4 py-3 sm:px-5">
              <LastIngestSummary lastIngest={lastIngest} loading={sigenergyLoading} />
            </div>
          )}

          {/* OEM cards — adapters; customerFacing hides ops stubs / dry-run tooling */}
          <div className="space-y-3 bg-slate-950/30 p-3 sm:p-4">
            {showEmptyGuidance && (
              <EnergySystemsEmptyState
                variant={emptyVariant}
                customerFacing={customerFacing}
              />
            )}

            <div className="space-y-3">
              {!sungrowOnly && (
                <SigenergyConnectionStatus
                  householdId={householdId}
                  variant="overview"
                  inverterMake={inverterMake}
                  customerFacing={customerFacing}
                />
              )}
              {/* Ops-only stub — never show "not implemented" under customerFacing impersonation. */}
              {!customerFacing && (
                <SungrowConnectionStatus
                  householdId={householdId}
                  variant="overview"
                  inverterMake={inverterMake}
                />
              )}
              {/* Future: <TeslaConnectionStatus householdId={...} variant="overview" ... /> */}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default EnergySystemsSection;
