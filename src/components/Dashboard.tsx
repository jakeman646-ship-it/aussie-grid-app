/**
 * Aussie Grid — Dashboard
 * File: src/components/Dashboard.tsx
 * Version: v0.1.2.41
 * Updated: 13 Aug 2026 — Last 7 days $ + informational decision from live readings.
 */
import { Component, Suspense, type ReactNode } from "react";
import { lazyWithReload } from "@/lib/lazyRetry";

const EnergyReadingsChart = lazyWithReload(() => import("@/components/EnergyReadingsChart"));
const WeeklyReadoutCharts = lazyWithReload(() => import("@/components/WeeklyReadoutCharts"));

/** Keeps a failed chart chunk from taking down the whole dashboard. */
class ChartErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-5 text-sm text-slate-400">
          The energy chart couldn&apos;t load. Refresh the page to try again.
        </section>
      );
    }
    return this.props.children;
  }
}
import {
  useHouseholdSnapshot,
  useImpersonation,
  useLatestDecision,
  useOutcomeRanks,
  usePilotHousehold,
  usePilotPhase,
  useWeeklyReadout,
  useRecentDailySavings,
  useLatestReadingAt,
  formatPhaseCountLabel,
  stopImpersonating,
} from "@/hooks";
import { useHouseholdReadings } from "@/hooks/useHouseholdReadings";
import {
  buildDecisionSummary,
  buildFriendlyReason,
  buildModeContextLine,
  formatHarmonyDetail,
} from "@/lib/decisionSummary";
import { formatTopPriorities } from "@/lib/outcomeRanks";
import {
  formatConfidence,
  formatGridFlow,
  formatModeHeadline,
  formatModeLabel,
  formatTimestamp,
} from "@/lib/modeLabels";
import { formatAppVersion } from "@/lib/version";
import type { AgentDecision } from "@/types/agentDecision";
import type { Mode } from "@/types/mode";
import { pilotPhaseLabel } from "@/types/pilotConfig";
import { type AgentControlMode, isAgentControlActive } from "@/types/agentControl";
import { AgentControlBanner } from "@/components/AgentControlBanner";
import {
  ConnectionHealthSummary,
  EnergySystemsSection,
  isHouseholdReadingFresh,
} from "@/components/energySystem";
import { getCurrentHouseholdId } from "@/lib/currentHousehold";
import {
  AWAITING_LIVE_DATA_MESSAGE,
  getImpersonationDataNotice,
} from "@/lib/impersonationDataStatus";
import { useState, useEffect, useRef } from "react";
import { supabase, queryTimeout, isSupabaseConfigured } from "@/lib/supabase";

const DEFAULT_USER_ID = getCurrentHouseholdId();

const OPERATING_MODES: { id: Mode; description: string }[] = [
  { id: "save", description: "Preserve battery charge for low-solar days or overnight use." },
  { id: "self_consume", description: "Use solar and battery first before importing from the grid." },
  { id: "sell", description: "Export surplus solar to the grid when conditions are favourable." },
  { id: "storm", description: "Build battery reserve ahead of severe weather or grid stress." },
];

function normalizeModeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function formatSavingsAud(value: number | null | undefined): string {
  if (value == null) return "—";
  return `$${value.toFixed(2)}`;
}

type SolarDayOutlook = "lower" | "average" | "good";

function classifyTomorrowSolar(irradiance: number | null | undefined, lowSolar: boolean): SolarDayOutlook | null {
  if (irradiance == null && !lowSolar) return null;
  if (lowSolar) return "lower";
  if (irradiance == null) return "average";
  if (irradiance >= 5) return "good";
  if (irradiance >= 3.5) return "average";
  return "lower";
}

function solarDayLabel(outlook: SolarDayOutlook): string {
  return { lower: "Lower solar day", average: "Average solar day", good: "Good solar day" }[outlook];
}

function tomorrowInterpretation(outlook: SolarDayOutlook): string {
  return {
    lower: "Lower solar expected tomorrow — the agent will likely preserve more battery overnight.",
    average: "A typical solar day is expected tomorrow — the agent will balance solar use and battery as usual.",
    good: "Good solar expected tomorrow — the agent should be able to run more on solar and charge the battery.",
  }[outlook];
}

function formatSunshineContext(irradiance: number, outlook: SolarDayOutlook): string {
  if (outlook === "good") return `Plenty of sunshine is forecast for Mackay tomorrow (around ${irradiance.toFixed(1)} kWh/m²).`;
  if (outlook === "average") return `Moderate sunshine is forecast for tomorrow (around ${irradiance.toFixed(1)} kWh/m²).`;
  return `Less sunshine than usual is forecast for tomorrow (around ${irradiance.toFixed(1)} kWh/m²).`;
}

function TomorrowOutlookSection({
  tomorrowIrradiance,
  lowSolar,
  isLive,
  weatherLoading,
}: {
  tomorrowIrradiance?: number | null;
  lowSolar: boolean;
  isLive?: boolean;
  weatherLoading?: boolean;
}) {
  const outlook = classifyTomorrowSolar(tomorrowIrradiance, lowSolar);

  return (
    <section className="rounded-lg border border-slate-700/80 bg-slate-900/40 px-5 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-emerald-400">Tomorrow&apos;s Outlook</h2>
        {isLive && (
          <span className="text-[10px] uppercase tracking-wide text-emerald-400/70 bg-emerald-950/60 px-2 py-0.5 rounded">Live • Open-Meteo</span>
        )}
      </div>
      {weatherLoading ? (
        <p className="mt-2 text-sm text-slate-400">Loading tomorrow&apos;s forecast…</p>
      ) : !outlook ? (
        <p className="mt-2 text-sm text-slate-400">Tomorrow&apos;s forecast not available yet.</p>
      ) : (
        <>
          <p className="mt-2 text-sm font-medium text-slate-200">{solarDayLabel(outlook)}</p>
          {tomorrowIrradiance != null ? (
            <p className="mt-1 text-sm text-slate-400">{formatSunshineContext(tomorrowIrradiance, outlook)}</p>
          ) : (
            <p className="mt-1 text-sm text-slate-400">Based on the latest weather forecast for Mackay.</p>
          )}
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{tomorrowInterpretation(outlook)}</p>
        </>
      )}
    </section>
  );
}

export interface DashboardProps {
  userId?: string;
  /** Bump to refetch all dashboard data in place (no remount). */
  refreshKey?: number;
  onConnectInverter?: () => void;
  onOpenProfile?: (hash?: string) => void;
  onOpenHelp?: () => void;
  onSignOut?: () => void;
  /** True while App.tsx is calling supabase.auth.signOut(). */
  signingOut?: boolean;
  onSwitchHousehold?: (newUserId: string) => void;
  hasPendingConnectionRequest?: boolean;
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-emerald-400">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function SavingsTrendsSection({
  readout,
  loading,
  recentSavings,
  recentLoading,
}: {
  readout: import("@/types/pilotConfig").WeeklyReadout | null;
  loading?: boolean;
  recentSavings?: import("@/hooks/useRecentDailySavings").RecentDailySavingsSummary | null;
  recentLoading?: boolean;
}) {
  return (
    <ChartErrorBoundary>
      <Suspense
        fallback={
          <div className="mt-4 rounded-md bg-slate-900/60 px-3 py-2 text-sm text-slate-400">
            Loading weekly readout charts…
          </div>
        }
      >
        <WeeklyReadoutCharts
          readout={readout}
          loading={loading}
          recentSavings={recentSavings}
          recentLoading={recentLoading}
        />
      </Suspense>
    </ChartErrorBoundary>
  );
}

function AppVersionFooter() {
  return (
    <footer className="flex justify-center border-t border-slate-800/80 pt-4 sm:justify-end">
      <p className="text-xs text-slate-500">{formatAppVersion()}</p>
    </footer>
  );
}

function PendingRequestBanner() {
  return (
    <div className="rounded-xl border border-amber-600/40 bg-amber-950/20 px-6 py-5">
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-lg font-semibold text-amber-300">Connection request received — thank you!</h3>
          <p className="mt-1 text-sm text-amber-100/90">
            We&apos;ve got your details and our team is now reviewing your request.
          </p>
        </div>
        <div className="rounded-lg border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm">
          <p className="font-medium text-amber-200 mb-2">What happens next:</p>
          <ul className="space-y-1.5 text-amber-100/90">
            <li>• We verify your Site ID and request read-only access from Sungrow</li>
            <li>• You&apos;ll receive a confirmation email once approved (usually within 1–2 business days)</li>
            <li>• Once live, this dashboard will show your real solar, battery, and grid data</li>
          </ul>
        </div>
        <p className="text-xs text-amber-300/80">
          You can keep exploring the dashboard below while we review your request.
        </p>
      </div>
    </div>
  );
}

function WelcomePilotOverview() {
  return (
    <section className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-5 py-4">
      <h2 className="text-lg font-medium text-emerald-400">Welcome to the Aussie Grid Mackay Pilot</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        We&apos;re working with local households to help the community use solar and batteries more wisely.
        By sharing your system data, you&apos;re helping us understand how homes can work together to save money and support the local grid.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        Your home&apos;s smart agent is learning from your solar and battery data right now.
        Default is read-only / suggest-only — the agent can suggest operating modes but does not
        change your inverter until a confirmed control path exists. You may save an agent control
        preference anytime once connected; 2–4 weeks of live readings is advised so reports and
        any later control choice are based on your home&apos;s real pattern.
      </p>
    </section>
  );
}

/** Live connection = recent household_readings (same 2h window as Energy Systems). Never token / *_connected_at. */
function isHouseholdConnected(lastReadingAt: string | null | undefined): boolean {
  return isHouseholdReadingFresh(lastReadingAt);
}

function connectionLabel(household: {
  inverter_make?: string | null;
  sungrow_connected_at?: string | null;
  tesla_connected_at?: string | null;
} | null | undefined): string {
  if (!household) return "system";
  if (household.tesla_connected_at || household.inverter_make === "Tesla") return "Tesla";
  if (household.sungrow_connected_at || household.inverter_make === "Sungrow") return "Sungrow";
  return household.inverter_make || "system";
}

function ConnectYourSystemPrompt({
  inverterMake,
  isConnected,
  onConnect,
}: {
  inverterMake?: string | null;
  isConnected?: boolean;
  onConnect?: () => void;
}) {
  if (isConnected) return null;

  const brand = inverterMake === "Tesla" ? "Tesla" : inverterMake === "Sungrow" ? "Sungrow" : "solar & battery";

  return (
    <section className="rounded-xl border border-emerald-600/40 bg-emerald-950/20 px-5 py-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-emerald-400">Connect your {brand} system</h2>
          <p className="mt-1 text-sm text-slate-300 max-w-md">
            To see your live solar, battery, and grid data in the pilot, connect your inverter.
          </p>
        </div>
        {onConnect && (
          <button
            onClick={onConnect}
            className="shrink-0 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition"
          >
            Connect Now
          </button>
        )}
      </div>
    </section>
  );
}

function NextStepsSection({
  isConnected,
  inverterMake,
  onConnect,
  awaitingLiveData = false,
}: {
  isConnected?: boolean;
  inverterMake?: string | null;
  onConnect?: () => void;
  /** Connected (or linked) but live telemetry / decisions not ready yet. */
  awaitingLiveData?: boolean;
}) {
  const brand = inverterMake === "Tesla" ? "Tesla" : inverterMake === "Sungrow" ? "Sungrow" : "inverter";

  if (!isConnected) {
    return (
      <section className="rounded-lg border border-emerald-600/40 bg-emerald-950/10 px-5 py-4">
        <h3 className="text-base font-semibold text-emerald-400">Next steps to get started</h3>
        <ol className="mt-3 space-y-2 text-sm text-slate-300 list-decimal list-inside">
          <li>Connect your {brand} system using the button above</li>
          <li>Once connected, we&apos;ll start collecting your solar &amp; battery data (read-only during this phase)</li>
          <li>Check back each day to see your agent&apos;s suggested operating mode and the reasoning</li>
          <li>Optionally save an agent control preference anytime after you connect (automatic inverter control still needs a confirmed path)</li>
        </ol>
        {onConnect && (
          <button
            onClick={onConnect}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            Connect {brand === "inverter" ? "system" : brand}
          </button>
        )}
        <p className="mt-3 text-xs text-emerald-300/80">We&apos;re learning together with a small group of Mackay households. Your feedback helps shape what comes next.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-emerald-600/35 bg-gradient-to-br from-emerald-950/35 via-slate-900/50 to-slate-900/40 px-5 py-5">
      <h3 className="text-lg font-semibold text-emerald-300">
        {awaitingLiveData
          ? "Waiting on a successful data pull"
          : "Here's what's next"}
      </h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
        {awaitingLiveData
          ? "Thanks for joining the Aussie Grid Mackay pilot. Authorise or Accept is not the same as connected. Live readings appear after a successful data pull — this page fills in then."
          : "Thanks for being part of the early Mackay pilot group. Your live readings help us build something useful for local households."}
      </p>
      <ol className="mt-4 space-y-3 text-sm text-slate-300">
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600/25 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/35">
            1
          </span>
          <span>
            <span className="font-medium text-slate-100">Watch for live data</span>
            <span className="mt-0.5 block text-slate-400">
              Solar, battery, and grid cards appear after the first successful data pull — usually
              within a day of connection.
            </span>
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600/25 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/35">
            2
          </span>
          <span>
            <span className="font-medium text-slate-100">Stay in read-only / suggest-only by default</span>
            <span className="mt-0.5 block text-slate-400">
              Your agent shares daily mode suggestions as live data arrives. It cannot change your
              inverter automatically until a confirmed control path exists — preference alone is
              not actuation.
            </span>
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600/25 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/35">
            3
          </span>
          <span>
            <span className="font-medium text-slate-100">Save agent control preference anytime</span>
            <span className="mt-0.5 block text-slate-400">
              Opt in when you want — connection required, not a waiting period. 2–4 weeks of live
              readings is advised before relying on reports or treating later control as informed.
            </span>
          </span>
        </li>
      </ol>
      <p className="mt-4 text-xs leading-relaxed text-emerald-300/85">
        Tip: refresh this page after a day or two if cards still look empty — new connections often
        need one full day of history before charts and savings light up.
      </p>
    </section>
  );
}

/** Single calm panel replacing a grid of empty metric cards. */
function PreparingLiveDataPanel() {
  return (
    <section
      role="status"
      className="rounded-xl border border-dashed border-slate-600/70 bg-slate-900/55 px-5 py-6"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/85">
        Live energy snapshot
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-100">Preparing your live readings</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
        Battery level, solar output, grid flow, home use, and savings will show here once we receive
        real telemetry from your system. We&apos;re not showing zeros or guesswork in the meantime.
      </p>
      <ul className="mt-4 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
        <li className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2">Battery &amp; solar — waiting on first pull</li>
        <li className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2">Grid &amp; home use — waiting on first pull</li>
        <li className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2">Yesterday&apos;s savings — after we have a full day</li>
        <li className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2">Mode suggestion — after the agent has data</li>
      </ul>
    </section>
  );
}

function classifyInformationalMode(snapshot: {
  solar_kw: number;
  grid_kw: number;
  battery_soc: number;
}): { label: string; sub: string } {
  const solar = Number(snapshot.solar_kw);
  const grid = Number(snapshot.grid_kw);
  const soc = Number(snapshot.battery_soc);
  const solarKw = Number.isFinite(solar) ? solar : 0;
  const gridKw = Number.isFinite(grid) ? grid : 0;
  const batterySoc = Number.isFinite(soc) ? soc : 0;

  // solar ≈ 0 / null and importing from grid
  if (Math.abs(solarKw) < 0.05 && gridKw > 0) {
    return {
      label: "Self-Consume",
      sub: "Night / low solar — use battery before grid if you choose. Informational only.",
    };
  }
  // surplus + high SOC
  if (solarKw >= 1.0 && batterySoc >= 80) {
    return {
      label: "Export-ready",
      sub: "Surplus available if you choose. Informational only.",
    };
  }
  return {
    label: "Self-Consume",
    sub: "Default monitoring view. Informational only.",
  };
}

function PreparingDecisionsPanel({
  liveSnapshot,
}: {
  liveSnapshot?: {
    solar_kw: number;
    grid_kw: number;
    battery_soc: number;
  } | null;
}) {
  if (liveSnapshot) {
    const view = classifyInformationalMode(liveSnapshot);
    return (
      <section
        role="status"
        className="rounded-xl border border-slate-700/80 bg-slate-900/55 px-5 py-6"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/85">
          Today&apos;s energy view
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-100">{view.label}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">{view.sub}</p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Informational view from live readings — not an agent decision, not automatic control.
        </p>
      </section>
    );
  }

  return (
    <section
      role="status"
      className="rounded-xl border border-dashed border-slate-600/70 bg-slate-900/55 px-5 py-6"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/85">
        Today&apos;s energy decision
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-100">Suggestions coming soon</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
        Once live readings are flowing, your household agent will record a daily mode suggestion
        here — with plain-English reasoning. Until then there is nothing to review, and that is
        expected for a new connection.
      </p>
      <p className="mt-3 text-xs text-slate-500">
        Read-only / suggest-only by default. You can save an agent control preference anytime once
        connected — that does not turn on automatic inverter changes today.
      </p>
    </section>
  );
}

const DEV_TEST_HOUSEHOLDS = [
  { id: "mm-electrical", label: "MM Electrical (Sigenergy commercial)" },
  { id: "sungrow-test-001", label: "Sungrow Test 001" },
  { id: "tesla-test-pilot-001", label: "Tesla Test Pilot 001" },
  { id: "mackay-pilot-01", label: "Mackay Pilot 01 (Sungrow connected)" },
  { id: "mackay-pilot-02", label: "Mackay Pilot 02 (Sungrow not connected)" },
  { id: "test-home-01", label: "Test Home 01 (simulated)" },
  { id: "test-home-02", label: "Test Home 02 (simulated)" },
];

function DevHouseholdSwitcher({
  currentId,
  onSwitch,
}: {
  currentId: string;
  onSwitch?: (id: string) => void;
}) {
  // Production must never show this — DEV only (security 2).
  if (!import.meta.env.DEV) return null;

  const options = [
    { id: currentId, label: `${currentId || "(none)"} (current)` },
    ...DEV_TEST_HOUSEHOLDS.filter((h) => h.id !== currentId),
  ];

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-950/30 px-2.5 py-1 text-[10px]">
      <span className="font-mono font-semibold text-amber-400">DEV</span>
      <select
        value={currentId || DEV_TEST_HOUSEHOLDS[0]?.id || ""}
        onChange={(e) => onSwitch?.(e.target.value)}
        className="bg-slate-950 border border-slate-700 text-amber-200 text-xs rounded px-1.5 py-0.5 focus:outline-none focus:border-amber-500"
      >
        {options.map((h) => (
          <option key={h.id} value={h.id}>
            {h.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CurrentModeCard({ mode, reason, contextLine }: { mode: string; reason: string; contextLine: string }) {
  return (
    <div className="rounded-xl border-2 border-emerald-500/35 bg-gradient-to-br from-emerald-950/50 via-slate-800/70 to-slate-800/60 p-5 shadow-lg shadow-emerald-950/30 sm:col-span-2 xl:col-span-1">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-lg text-emerald-300 ring-1 ring-emerald-500/30">⚡</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/80">Your setting today</p>
          <p className="mt-1 text-4xl font-bold leading-tight text-emerald-300">{formatModeHeadline(mode)}</p>
          <p className="mt-3 text-base font-medium leading-relaxed text-slate-100">{reason}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300"><span className="font-semibold text-emerald-300/90">Why this mode?</span> {contextLine}</p>
        </div>
      </div>
    </div>
  );
}

function DecisionSummaryBlock({
  decision,
  topPrioritiesLabel,
  dataHealthy,
}: {
  decision: AgentDecision;
  topPrioritiesLabel?: string | null;
  dataHealthy?: boolean;
}) {
  const summary = buildDecisionSummary(
    decision,
    dataHealthy && topPrioritiesLabel
      ? { topPrioritiesLabel }
      : undefined,
  );
  return (
    <div className="mt-4 rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-4">
      <h3 className="text-sm font-semibold text-emerald-300">Why this mode?</h3>
      <p className="mt-3 text-base leading-relaxed text-slate-100">{summary}</p>
      <p className="mt-2 text-xs text-slate-500">This is a plain-English summary of your latest energy decision.</p>
    </div>
  );
}

function OutcomePrioritiesBanner({
  topPrioritiesLabel,
  dataHealthy,
  hasSavedRow,
  onChangePriorities,
}: {
  topPrioritiesLabel: string;
  dataHealthy: boolean;
  hasSavedRow: boolean;
  onChangePriorities?: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 sm:p-5">
      <p className="text-sm text-slate-300">
        <span className="font-medium text-slate-200">Your priorities: </span>
        {topPrioritiesLabel}
      </p>
      {dataHealthy ? (
        <p className="mt-2 text-sm text-emerald-300/90">
          Optimising suggestions for: {topPrioritiesLabel}
        </p>
      ) : (
        <p className="mt-2 text-sm text-amber-200/90">
          {hasSavedRow
            ? "Priorities saved — ranked suggestions pause until fresh readings"
            : "Ranked suggestions pause until fresh readings"}
        </p>
      )}
      {onChangePriorities && (
        <button
          type="button"
          onClick={onChangePriorities}
          className="mt-3 text-sm font-medium text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline"
        >
          Change priorities
        </button>
      )}
    </section>
  );
}

function OperatingModeInfoCard({
  modeId,
  label,
  description,
  isActive,
}: {
  modeId: Mode;
  label: string;
  description: string;
  isActive: boolean;
}) {
  return (
    <div
      aria-label={`${label} (${modeId}) — agent controlled, informational only`}
      className={`relative cursor-default rounded-lg border p-4 ${isActive ? "border-emerald-700/40 bg-slate-800/50 ring-1 ring-emerald-600/25" : "border-slate-700/60 bg-slate-800/30 opacity-90"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-medium text-slate-200">{label}</p>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-400 ring-1 ring-slate-600/50">
          <span aria-hidden>🔒</span> Agent
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
      {isActive ? <p className="mt-3 text-xs font-medium text-emerald-400/90">Active now</p> : <p className="mt-3 text-xs text-slate-500">Informational only</p>}
    </div>
  );
}

function OperatingModesSection({ activeMode, controlMode }: { activeMode: string; controlMode: AgentControlMode }) {
  const activeKey = normalizeModeKey(activeMode);
  const phaseNote = isAgentControlActive(controlMode)
    ? "The agent automatically chooses and applies the best mode on your inverter."
    : "Read-only mode — the agent suggests operating modes but cannot change your inverter until you activate agent control.";
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-5">
      <h2 className="text-lg font-medium text-emerald-400">Operating Modes</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{phaseNote}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {OPERATING_MODES.map(({ id, description }) => (
          <OperatingModeInfoCard key={id} modeId={id} label={formatModeLabel(id)} description={description} isActive={activeKey === id} />
        ))}
      </div>
    </section>
  );
}

function LoadingState({ onSkip }: { onSkip?: () => void }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
      <p className="text-sm">Loading pilot dashboard…</p>
      {onSkip && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={onSkip}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
          >
            Skip and show dashboard
          </button>
        </div>
      )}
    </div>
  );
}

function WarningBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-600/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
      {message}
    </div>
  );
}

/** Calm status banner — missing pilot data is expected, not an outage. */
function SoftStatusNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-emerald-700/35 bg-emerald-950/20 px-4 py-3.5 text-sm leading-relaxed text-slate-200"
    >
      {message}
    </div>
  );
}

/** Shown at the top when an admin is viewing another household's dashboard. */
function AdminImpersonationBanner({ householdId }: { householdId: string }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-violet-500/50 bg-violet-950/80 px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
        <p className="text-sm font-semibold tracking-wide text-violet-100">
          Admin View – Impersonating {householdId}
        </p>
        {/* Clears ?impersonate= and reloads so hooks use the logged-in household again. */}
        <button
          type="button"
          onClick={stopImpersonating}
          className="shrink-0 rounded-md border border-violet-400/35 bg-violet-900/50 px-2.5 py-1 text-xs font-medium text-violet-100 hover:border-violet-300/50 hover:bg-violet-800/60 hover:text-white transition-colors"
        >
          Stop impersonating
        </button>
      </div>
    </div>
  );
}

function PhaseCountBadge({ phaseCount }: { phaseCount?: number | null }) {
  const label = formatPhaseCountLabel(phaseCount);
  if (!label) return null;

  return (
    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-slate-600/50">
      {label}
    </span>
  );
}

/** One-line connection health — full detail lives in How this works. */
function CompactConnectionHealthLine({
  lastReadingLabel,
  fromLiveReadings,
}: {
  lastReadingLabel: string | null;
  fromLiveReadings: boolean;
}) {
  return (
    <section
      role="status"
      className="rounded-lg border border-slate-700/70 bg-slate-900/50 px-4 py-3"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500/90">
        Connection Health
      </p>
      <p className="mt-1 text-sm text-slate-200">
        {fromLiveReadings ? "Monitoring · read-only" : "Waiting on a successful data pull"}
        {lastReadingLabel ? (
          <>
            {" · "}
            Last reading {lastReadingLabel}
            {fromLiveReadings ? " · from live readings" : ""}
          </>
        ) : (
          " · no recent household reading"
        )}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        Connected status needs a usable data pull — never Accept or OAuth alone.
      </p>
    </section>
  );
}

export function Dashboard({
  userId = DEFAULT_USER_ID,
  refreshKey = 0,
  onConnectInverter,
  onOpenProfile,
  onOpenHelp,
  onSignOut,
  signingOut = false,
  onSwitchHousehold,
  hasPendingConnectionRequest = false,
}: DashboardProps) {
  // ?impersonate=<household_id> lets admins (or dev) load another household's data.
  const {
    effectiveHouseholdId,
    isImpersonating,
    impersonatedHouseholdId,
    checking: impersonationChecking,
    denied: impersonationDenied,
  } = useImpersonation(userId);

  const householdQuery = usePilotHousehold(effectiveHouseholdId, { isImpersonating });
  const phaseQuery = usePilotPhase();
  const householdId = householdQuery.data?.household_id ?? effectiveHouseholdId;
  const snapshotQuery = useHouseholdSnapshot(householdId, { isImpersonating });
  const decisionQuery = useLatestDecision(householdId, { isImpersonating });
  const readingsQuery = useHouseholdReadings(householdId);
  const readoutQuery = useWeeklyReadout(householdId);
  const recentSavingsQuery = useRecentDailySavings(householdId);
  const outcomeRanksQuery = useOutcomeRanks(householdId, { isImpersonating });

  const loading = householdQuery.loading || snapshotQuery.loading || decisionQuery.loading;
  const queryError = householdQuery.error?.message ?? snapshotQuery.error?.message ?? decisionQuery.error?.message;

  const household = householdQuery.data;
  const snapshot = snapshotQuery.data;
  const decision = decisionQuery.data;

  const hasLiveSnapshot =
    snapshot != null && snapshot.data_source !== "no_data" && snapshot.data_source !== "simulated";

  // Prefer snapshot timestamp only when it came from real readings (never the Date.now() fallback).
  const snapshotReadingAt =
    hasLiveSnapshot && snapshot?.last_updated ? snapshot.last_updated : null;
  const { lastReadingAt } = useLatestReadingAt(householdId, snapshotReadingAt);

  const impersonationDataReady =
    !householdQuery.loading && !snapshotQuery.loading && !decisionQuery.loading;

  const refetchAll = () => {
    householdQuery.refetch();
    snapshotQuery.refetch();
    decisionQuery.refetch();
    readingsQuery.refetch();
    readoutQuery.refetch();
    recentSavingsQuery.refetch();
    phaseQuery.refetch();
  };

  // Refetch in place when the app shell bumps refreshKey (e.g. after a
  // connection request). The Dashboard used to be remounted via a React key
  // instead, which discarded all loaded data and froze returning users on the
  // full-screen loading state until every query resolved again.
  const lastRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== lastRefreshKey.current) {
      lastRefreshKey.current = refreshKey;
      refetchAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const [liveTomorrowIrradiance, setLiveTomorrowIrradiance] = useState<number | null>(null);
  const [liveLowSolar, setLiveLowSolar] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const lat = -21.15;
        const lon = 149.19;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=shortwave_radiation_sum,weathercode&timezone=Australia/Brisbane&forecast_days=2`;

        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error("Weather fetch failed");

        const data = await res.json();
        const tomorrowIrr = data?.daily?.shortwave_radiation_sum?.[1] ?? null;
        const tomorrowCode = data?.daily?.weathercode?.[1] ?? 0;

        setLiveTomorrowIrradiance(tomorrowIrr);
        setLiveLowSolar(tomorrowCode >= 3 || (tomorrowIrr != null && tomorrowIrr < 3.6));
      } catch {
        console.warn("Open-Meteo fetch failed, using decision fallback if available");
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, []);

  const effectiveTomorrowIrradiance = liveTomorrowIrradiance ?? decision?.tomorrow_irradiance_kwh_m2 ?? decision?.reasoning?.weather?.tomorrow_irradiance_kwh_m2;
  const effectiveLowSolar = liveLowSolar || (decision?.reasoning?.weather?.low_solar_forecast ?? false);
  const usingLiveWeather = liveTomorrowIrradiance != null;

  const [hasPendingFromDb, setHasPendingFromDb] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);

  useEffect(() => {
    if (!householdId) return;

    const checkPendingRequest = async () => {
      const { data, error } = await supabase
        .from("pilot_connection_requests")
        .select("id")
        .eq("household_id", householdId)
        .eq("status", "pending_review")
        .abortSignal(queryTimeout())
        .limit(1);

      if (!error && data && data.length > 0) {
        setHasPendingFromDb(true);
      } else {
        setHasPendingFromDb(false);
      }
    };

    checkPendingRequest();
  }, [householdId]);

  const effectivePending = hasPendingConnectionRequest || hasPendingFromDb;
  const pilotPhase = phaseQuery.phase;
  const agentControlMode: AgentControlMode = household?.agent_control_mode === "agent_control" ? "agent_control" : "read_only";
  const householdConnected = isHouseholdConnected(lastReadingAt);
  const householdLinked = Boolean(household);
  const brand = connectionLabel(household);
  const phaseCountLabel = formatPhaseCountLabel(household?.phase_count);

  // Registry row (or pending) but no usable live telemetry yet — collapse empty cards.
  const awaitingLiveData =
    impersonationDataReady &&
    !hasLiveSnapshot &&
    (householdLinked || effectivePending);

  const impersonationDataNotice =
    isImpersonating && impersonationDataReady
      ? getImpersonationDataNotice({
          householdMissing: !household,
          hasQueryError: Boolean(queryError),
          hasLiveSnapshot,
        })
      : null;

  const awaitingDataNotice =
    !isImpersonating && awaitingLiveData ? AWAITING_LIVE_DATA_MESSAGE : null;

  const statusNotice = impersonationDataNotice ?? awaitingDataNotice;
  const energySystemsCustomerFacing = isImpersonating || awaitingLiveData;

  if ((loading || impersonationChecking) && !skipLoading && !snapshot && !household && !decision) {
    return <LoadingState onSkip={() => setSkipLoading(true)} />;
  }

  const mode = hasLiveSnapshot || decision ? (snapshot?.mode ?? decision?.mode ?? "—") : "—";
  const reason =
    decision?.reason ??
    (hasLiveSnapshot ? snapshot?.reason : null) ??
    (awaitingLiveData
      ? "Preparing your first readings — suggestions appear once live data arrives"
      : "No decision recorded yet");
  const dataSource = snapshot?.data_source ?? "simulated";
  const isLiveData = dataSource === "supabase" || dataSource === "live";

  const proposedMode = decision?.reasoning?.proposal?.mode;
  const finalMode = decision?.reasoning?.final?.mode ?? decision?.mode;
  const harmonyInfluenced = decision?.harmony_influenced ?? false;

  const topPrioritiesLabel = formatTopPriorities(outcomeRanksQuery.ranks, 3);
  // Healthy = live snapshot + a real decision + not in the “awaiting first readings” path.
  // Never claim “optimising” when impersonation/awaiting notices mean data is incomplete.
  const prioritiesDataHealthy = Boolean(
    hasLiveSnapshot && decision && !awaitingLiveData && !statusNotice,
  );
  const modeContextLine = buildModeContextLine(decision ?? undefined, reason, {
    topPrioritiesLabel,
    dataHealthy: prioritiesDataHealthy,
  });
  const friendlyReason = buildFriendlyReason(reason, String(mode));

  const yesterdaySavings = formatSavingsAud(snapshot?.yesterday_savings_aud);
  const cumulativeSavings = formatSavingsAud(snapshot?.cumulative_savings_aud);
  const savingsHint = snapshot?.data_quality_note
    ? `${snapshot.data_quality_note} • Ergon 12D TOU + 6c FIT`
    : "Calculated from your live solar + battery data + Ergon tariffs";

  return (
    <div className="space-y-6 bg-slate-950 p-6 text-slate-100">
      {isImpersonating && impersonatedHouseholdId && (
        <AdminImpersonationBanner householdId={impersonatedHouseholdId} />
      )}

      {impersonationDenied && (
        <WarningBanner message="Impersonation is only available in development or for admin accounts. Showing your own household data." />
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-emerald-400">Aussie Grid Pilot Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Mackay pilot — {isAgentControlActive(agentControlMode) ? "Agent control active" : pilotPhaseLabel(pilotPhase)}
          </p>
          {household && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {isImpersonating ? (
                <p className="text-sm text-slate-300">
                  {[
                    household.inverter_make || null,
                    householdConnected
                      ? "Connected"
                      : effectivePending
                        ? "Connection pending"
                        : "Waiting on live readings",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : (
                <p className="text-sm text-slate-300">
                  {household.household_id}
                  {household.is_test ? " · test home" : ""} · {household.status}
                  {household.inverter_make ? ` · ${household.inverter_make}` : ""}
                </p>
              )}
              <PhaseCountBadge phaseCount={household.phase_count} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isImpersonating && (
            <DevHouseholdSwitcher currentId={effectiveHouseholdId} onSwitch={onSwitchHousehold} />
          )}

          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              isLiveData
                ? "bg-emerald-900/60 text-emerald-300"
                : awaitingLiveData
                  ? "bg-sky-900/50 text-sky-200"
                  : "bg-amber-900/40 text-amber-200"
            }`}
          >
            {isLiveData
              ? "Live data"
              : awaitingLiveData
                ? "Preparing live data"
                : "Sample data for now"}
          </span>

          <button onClick={refetchAll} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Refresh
          </button>

          {onOpenHelp && <button onClick={onOpenHelp} className="rounded-md border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">Help</button>}
          {onOpenProfile && <button onClick={() => onOpenProfile()} className="rounded-md border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">Profile</button>}
          {onConnectInverter && <button onClick={onConnectInverter} className="rounded-md border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">Connect Inverter</button>}
          {onSignOut && (
            <button
              onClick={onSignOut}
              disabled={signingOut}
              className="rounded-md border border-red-600/60 px-3 py-2 text-sm text-red-400 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          )}
        </div>
      </header>

      {!isSupabaseConfigured && (
        <WarningBanner message="This deployment is missing its database configuration (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Live data can't load until these are set in Vercel project settings." />
      )}

      {queryError && (
        <WarningBanner
          message={
            isImpersonating
              ? queryError
              : `Data temporarily unavailable: ${queryError}. You can still connect your system below — this is normal for new pilot households.`
          }
        />
      )}

      {statusNotice && <SoftStatusNotice message={statusNotice} />}

      {effectivePending && <PendingRequestBanner />}

      {/* 4–5. LIVE + $ strips — same order mobile & desktop; optional side-by-side on lg+ */}
      {awaitingLiveData ? (
        <PreparingLiveDataPanel />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 sm:p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500/90">
              Live now
            </h2>
            <div className="mt-3 grid gap-3 grid-cols-2 sm:grid-cols-4">
              <MetricCard
                label="Battery level"
                value={hasLiveSnapshot && snapshot ? `${snapshot.battery_soc.toFixed(0)}%` : "—"}
                hint={
                  hasLiveSnapshot
                    ? "How full your home battery is right now"
                    : "Appears after the first live data pull"
                }
              />
              <MetricCard
                label="Solar output"
                value={hasLiveSnapshot && snapshot ? `${snapshot.solar_kw.toFixed(1)} kW` : "—"}
                hint={hasLiveSnapshot ? "Power your panels are generating now" : undefined}
              />
              <MetricCard
                label="Home usage"
                value={
                  hasLiveSnapshot && snapshot
                    ? `${snapshot.consumption_kw.toFixed(1)} kW`
                    : "—"
                }
                hint={hasLiveSnapshot ? "Power your home is using right now" : undefined}
              />
              <MetricCard
                label="Grid flow"
                value={hasLiveSnapshot && snapshot ? formatGridFlow(snapshot.grid_kw) : "—"}
                hint={
                  hasLiveSnapshot
                    ? "Whether you're importing from or exporting to the grid"
                    : undefined
                }
              />
            </div>
            {hasLiveSnapshot && snapshot && (
              <p className="mt-3 text-xs text-slate-500">
                Last updated {formatTimestamp(snapshot.last_updated)}
              </p>
            )}
          </section>

          <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 sm:p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500/90">
              Estimated savings
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MetricCard
                label="Yesterday's savings"
                value={yesterdaySavings}
                hint={
                  hasLiveSnapshot
                    ? savingsHint
                    : "Calculated after we have a full day of readings"
                }
              />
              <MetricCard
                label="Savings so far (pilot)"
                value={cumulativeSavings}
                hint={
                  snapshot?.days_of_data
                    ? `${snapshot.days_of_data} day${snapshot.days_of_data === 1 ? "" : "s"} of data • cumulative Ergon 12D savings`
                    : "Total savings from your available readings"
                }
              />
            </div>
            <SavingsTrendsSection
              readout={readoutQuery.data}
              loading={readoutQuery.loading}
              recentSavings={recentSavingsQuery.data}
              recentLoading={recentSavingsQuery.loading}
            />
          </section>
        </div>
      )}

      {/* 6. Last 24 Hours chart — full width under $ */}
      <ChartErrorBoundary>
        <Suspense
          fallback={
            <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-5 text-sm text-slate-400">
              Loading chart…
            </section>
          }
        >
          <EnergyReadingsChart readings={readingsQuery.readings} />
        </Suspense>
      </ChartErrorBoundary>

      {/* 7. Your setting today */}
      {!awaitingLiveData && (
        <CurrentModeCard
          mode={String(mode)}
          reason={friendlyReason}
          contextLine={modeContextLine}
        />
      )}

      {/* 8. Tomorrow's Outlook */}
      <TomorrowOutlookSection
        tomorrowIrradiance={effectiveTomorrowIrradiance}
        lowSolar={effectiveLowSolar}
        isLive={usingLiveWeather}
        weatherLoading={weatherLoading}
      />

      {/* 9. Connection Health — one-line; full detail in How this works */}
      <CompactConnectionHealthLine
        lastReadingLabel={
          lastReadingAt ? formatTimestamp(lastReadingAt) : null
        }
        fromLiveReadings={householdConnected}
      />

      {/* 10. Priorities — compact */}
      {!outcomeRanksQuery.loading && (
        <OutcomePrioritiesBanner
          topPrioritiesLabel={topPrioritiesLabel}
          dataHealthy={prioritiesDataHealthy}
          hasSavedRow={outcomeRanksQuery.hasSavedRow}
          onChangePriorities={
            onOpenProfile ? () => onOpenProfile("#priorities") : undefined
          }
        />
      )}

      {/* 11. How this works — collapsed by default */}
      <details className="group rounded-lg border border-slate-700 bg-slate-900/70">
        <summary className="cursor-pointer list-none px-4 py-3 sm:px-5 sm:py-4 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-emerald-400">How this works</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Monitoring · read-only · connection honesty · what&apos;s next
              </p>
            </div>
            <span className="shrink-0 text-xs text-slate-500 group-open:hidden">Show</span>
            <span className="hidden shrink-0 text-xs text-slate-500 group-open:inline">Hide</span>
          </div>
        </summary>
        <div className="space-y-4 border-t border-slate-700/80 px-4 py-4 sm:px-5">
          {household && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
              {householdConnected ? (
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium text-slate-200">
                    {brand} monitoring · read-only
                  </span>
                  <span className="text-xs text-slate-500">
                    last reading{" "}
                    {lastReadingAt
                      ? new Date(lastReadingAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </span>
                </div>
              ) : effectivePending ? (
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <div>
                    <span className="text-sm font-medium text-amber-200">
                      Connection request pending review
                    </span>
                    <p className="text-xs text-amber-300/80">
                      Our team will activate read-only access within 1–2 business days
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span className="text-sm font-medium text-slate-200">
                    Waiting on a successful data pull
                  </span>
                </div>
              )}

              {!householdConnected && !effectivePending && onConnectInverter && (
                <button
                  onClick={onConnectInverter}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
                >
                  Connect {brand === "system" ? "system" : brand}
                </button>
              )}
            </div>
          )}

          <ConnectionHealthSummary
            householdId={householdId}
            inverterMake={household?.inverter_make}
            customerFacing={energySystemsCustomerFacing}
            lastReadingAt={lastReadingAt}
          />
          <EnergySystemsSection
            householdId={householdId}
            inverterMake={household?.inverter_make}
            customerFacing={energySystemsCustomerFacing}
            lastReadingAt={lastReadingAt}
          />

          <AgentControlBanner
            householdId={householdId}
            mode={agentControlMode}
            isConnected={householdConnected}
            isImpersonating={isImpersonating}
            onActivated={() => householdQuery.refetch()}
          />

          {!householdLinked && <WelcomePilotOverview />}

          <ConnectYourSystemPrompt
            inverterMake={household?.inverter_make}
            isConnected={householdLinked}
            onConnect={onConnectInverter}
          />

          <NextStepsSection
            isConnected={householdLinked}
            inverterMake={household?.inverter_make}
            onConnect={onConnectInverter}
            awaitingLiveData={awaitingLiveData}
          />
        </div>
      </details>

      {/* 12. Operating Modes */}
      <OperatingModesSection activeMode={String(mode)} controlMode={agentControlMode} />

      {/* 13. Today's Energy Decision / Suggestions */}
      {awaitingLiveData || !decision ? (
        <PreparingDecisionsPanel
          liveSnapshot={
            hasLiveSnapshot && snapshot
              ? {
                  solar_kw: snapshot.solar_kw,
                  grid_kw: snapshot.grid_kw,
                  battery_soc: snapshot.battery_soc,
                }
              : null
          }
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-5">
            <h2 className="text-lg font-medium text-emerald-400">Today&apos;s energy decision</h2>
            <>
              <DecisionSummaryBlock
                decision={decision}
                topPrioritiesLabel={topPrioritiesLabel}
                dataHealthy={prioritiesDataHealthy}
              />
              <dl className="mt-5 space-y-3 border-t border-slate-700/80 pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">First suggestion</dt>
                  <dd>{formatModeLabel(String(proposedMode ?? mode))}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Mode in use</dt>
                  <dd>{formatModeLabel(String(finalMode ?? mode))}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">How confident</dt>
                  <dd>{formatConfidence(decision.confidence ?? 0)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Safety check</dt>
                  <dd>
                    {decision.verification_passed ? "Passed" : "Adjusted for safety"}
                    {decision.severity && !decision.verification_passed
                      ? ` (${decision.severity})`
                      : ""}
                  </dd>
                </div>
                {decision.harmony_recommendation && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">Coordinated with other homes</dt>
                    <dd>
                      {formatHarmonyDetail(decision.harmony_recommendation)}
                      {harmonyInfluenced ? " · affected today's mode" : ""}
                    </dd>
                  </div>
                )}
                {!isImpersonating && (
                  <div>
                    <dt className="text-slate-400">Technical note</dt>
                    <dd className="mt-1 text-slate-200">{decision.reason}</dd>
                  </div>
                )}
              </dl>
            </>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-5">
            <h2 className="text-lg font-medium text-emerald-400">
              When today&apos;s decision was made
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Snapshot of your home at the time of the latest agent update.
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              {decision.reasoning?.context ? (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">Battery level when decided</dt>
                    <dd>
                      {decision.reasoning.context.battery_soc != null
                        ? `${decision.reasoning.context.battery_soc}%`
                        : "Not recorded"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">Solar when decided</dt>
                    <dd>
                      {decision.reasoning.context.solar_power_w != null
                        ? `${(decision.reasoning.context.solar_power_w / 1000).toFixed(1)} kW`
                        : "Not recorded"}
                    </dd>
                  </div>
                </>
              ) : (
                <p className="text-slate-500">
                  Decision context will appear here once the agent records a full snapshot.
                </p>
              )}
            </dl>
          </div>
        </section>
      )}

      {/* 14. Your home details */}
      {household && (
        <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-lg font-medium text-emerald-400">Your home details</h2>
          {awaitingLiveData &&
          household.battery_capacity_kwh == null &&
          household.solar_kw == null &&
          !phaseCountLabel ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              System size and phase details will fill in as we learn more about your setup. Pilot
              consent:{" "}
              <span className="text-slate-200">
                {household.consent_given ? "Confirmed" : "Still pending"}
              </span>
              .
            </p>
          ) : (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-400">Battery size</dt>
                <dd>
                  {household.battery_capacity_kwh != null
                    ? `${household.battery_capacity_kwh} kWh`
                    : "We'll add this when known"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Solar system size</dt>
                <dd>
                  {household.solar_kw != null
                    ? `${household.solar_kw} kW`
                    : "We'll add this when known"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Supply phase</dt>
                <dd>
                  {phaseCountLabel ? (
                    <PhaseCountBadge phaseCount={household.phase_count} />
                  ) : (
                    "We'll add this when known"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Pilot consent</dt>
                <dd>{household.consent_given ? "Confirmed" : "Still pending"}</dd>
              </div>
            </dl>
          )}
        </section>
      )}

      {!isImpersonating && <AppVersionFooter />}
    </div>
  );
}

export default Dashboard;
