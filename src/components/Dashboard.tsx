import {
  useHouseholdSnapshot,
  useLatestDecision,
  usePilotHousehold,
} from "@/hooks";
import {
  buildDecisionSummary,
  buildFriendlyReason,
  buildModeContextLine,
  formatHarmonyDetail,
} from "@/lib/decisionSummary";
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
import { getCurrentHouseholdId } from "@/lib/currentHousehold";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

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

function TomorrowOutlookSection({ tomorrowIrradiance, lowSolar }: { tomorrowIrradiance?: number | null; lowSolar: boolean }) {
  const outlook = classifyTomorrowSolar(tomorrowIrradiance, lowSolar);
  return (
    <section className="rounded-lg border border-slate-700/80 bg-slate-900/40 px-5 py-4">
      <h2 className="text-base font-medium text-emerald-400">Tomorrow&apos;s Outlook</h2>
      {!outlook ? (
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
  onConnectInverter?: () => void;
  onOpenProfile?: () => void;
  onOpenHelp?: () => void;
  onSignOut?: () => void;
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

function SavingsTrendsPlaceholder() {
  return (
    <div className="mt-4 rounded-md bg-slate-900/60 px-3 py-2">
      <p className="text-sm leading-relaxed text-slate-400">Daily and weekly savings views will be available in a future update.</p>
    </div>
  );
}

function AppVersionFooter() {
  let displayVersion = "v0.8.2";
  try { displayVersion = formatAppVersion(); } catch {}
  return (
    <footer className="flex justify-center border-t border-slate-800/80 pt-4 sm:justify-end">
      <p className="text-xs text-slate-500">{displayVersion}</p>
    </footer>
  );
}

function ReadOnlyPilotBanner() {
  return (
    <div role="status" className="rounded-lg border border-emerald-600/40 bg-emerald-950/20 px-4 py-3">
      <p className="text-sm font-medium text-emerald-300">Pre-pilot learning phase</p>
      <p className="mt-1 text-sm leading-relaxed text-emerald-100/90">
        We&apos;re currently in an early data collection stage with a small group of Mackay households.
        During this phase, we&apos;re only reading data from your solar and battery system — we cannot control your inverter or change any settings yet.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-emerald-100/90">
        Once we&apos;ve seen enough data from participating homes, we&apos;ll move into the active pilot phase where the agent can start setting operating modes on your system.
      </p>
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
        During this pre-pilot phase, everything is read-only — the agent suggests operating modes but cannot control your inverter yet.
        Once we&apos;ve seen enough data from participating homes, we&apos;ll move into the active pilot phase where the agent can start setting modes on your system.
      </p>
    </section>
  );
}

function ConnectYourSystemPrompt({
  inverterMake,
  isConnected,
  onConnect
}: {
  inverterMake?: string | null;
  isConnected?: boolean;
  onConnect?: () => void;
}) {
  if (inverterMake === "Sungrow" && isConnected) return null;

  return (
    <section className="rounded-xl border border-emerald-600/40 bg-emerald-950/20 px-5 py-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-emerald-400">Connect your Sungrow system</h2>
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
  onConnect
}: {
  isConnected?: boolean;
  onConnect?: () => void;
}) {
  if (!isConnected) {
    return (
      <section className="rounded-lg border border-emerald-600/40 bg-emerald-950/10 px-5 py-4">
        <h3 className="text-base font-semibold text-emerald-400">Next steps to get started</h3>
        <ol className="mt-3 space-y-2 text-sm text-slate-300 list-decimal list-inside">
          <li>Connect your Sungrow inverter using the button above</li>
          <li>Once connected, we’ll start collecting your solar &amp; battery data (read-only during this phase)</li>
          <li>Check back each day to see your agent’s suggested operating mode and the reasoning</li>
          <li>In the coming weeks we’ll move into the active pilot phase — the agent will start setting modes on your system</li>
        </ol>
        <p className="mt-3 text-xs text-emerald-300/80">We’re learning together with a small group of Mackay households. Your feedback helps shape what comes next.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-5 py-4">
      <h3 className="text-base font-semibold text-emerald-400">You’re connected — here’s what’s next</h3>
      <ul className="mt-3 space-y-2 text-sm text-slate-300 list-disc list-inside">
        <li>Check the dashboard daily to see your agent’s latest suggestion and why it chose that mode</li>
        <li>Review “Today’s energy decision” and “Tomorrow’s Outlook” for context</li>
        <li>We’re still in the pre-pilot learning phase — everything is read-only while we gather data from participating homes</li>
        <li>Once we’ve seen enough data, we’ll move to the active phase where the agent can control operating modes for you</li>
      </ul>
      <p className="mt-3 text-xs text-emerald-300/80">Thanks for being part of the early group — your data is helping us build something useful for Mackay households.</p>
    </section>
  );
}

const DEV_TEST_HOUSEHOLDS = [
  { id: "mackay-pilot-01", label: "Mackay Pilot 01 (Sungrow connected)" },
  { id: "mackay-pilot-02", label: "Mackay Pilot 02 (Sungrow not connected)" },
  { id: "test-home-01", label: "Test Home 01 (simulated)" },
  { id: "test-home-02", label: "Test Home 02 (simulated)" },
];

function DevHouseholdSwitcher({
  currentId,
  onSwitch
}: {
  currentId: string;
  onSwitch?: (id: string) => void;
}) {
  const isDev = process.env.NODE_ENV === "development";
  const looksLikeTest = currentId.includes("test") || currentId.includes("pilot") || currentId.includes("mackay");
  if (!isDev && !looksLikeTest) return null;

  const options = [
    { id: currentId, label: `${currentId} (current)` },
    ...DEV_TEST_HOUSEHOLDS.filter((h) => h.id !== currentId),
  ];

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-950/30 px-2.5 py-1 text-[10px]">
      <span className="font-mono font-semibold text-amber-400">DEV</span>
      <select
        value={currentId}
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

function DecisionSummaryBlock({ decision }: { decision: AgentDecision }) {
  return (
    <div className="mt-4 rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-4">
      <h3 className="text-sm font-semibold text-emerald-300">Why this mode?</h3>
      <p className="mt-3 text-base leading-relaxed text-slate-100">{buildDecisionSummary(decision)}</p>
      <p className="mt-2 text-xs text-slate-500">This is a plain-English summary of your latest energy decision.</p>
    </div>
  );
}

function OperatingModeInfoCard({ modeId, label, description, isActive }: { modeId: Mode; label: string; description: string; isActive: boolean }) {
  return (
    <div aria-label={`${label} — agent controlled, informational only`} className={`relative cursor-default rounded-lg border p-4 ${isActive ? "border-emerald-700/40 bg-slate-800/50 ring-1 ring-emerald-600/25" : "border-slate-700/60 bg-slate-800/30 opacity-90"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-medium text-slate-200">{label}</p>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 ring-1 ring-slate-600/50">
          <span aria-hidden>🔒</span> Agent
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
      {isActive ? <p className="mt-3 text-xs font-medium text-emerald-400/90">Active now</p> : <p className="mt-3 text-xs text-slate-500">Informational only</p>}
    </div>
  );
}

function OperatingModesSection({ activeMode }: { activeMode: string }) {
  const activeKey = normalizeModeKey(activeMode);
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-5">
      <h2 className="text-lg font-medium text-emerald-400">Operating Modes</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">During this read-only pilot phase, the agent automatically chooses the best mode each day. Manual override will be available in a future update.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {OPERATING_MODES.map(({ id, description }) => (
          <OperatingModeInfoCard key={id} modeId={id} label={formatModeLabel(id)} description={description} isActive={activeKey === id} />
        ))}
      </div>
    </section>
  );
}

function LoadingState() {
  return <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center text-slate-400">Loading pilot dashboard…</div>;
}

function WarningBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-600/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
      {message}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-200">{message}</div>;
}

export function Dashboard({
  userId = DEFAULT_USER_ID,
  onConnectInverter,
  onOpenProfile,
  onOpenHelp,
  onSignOut,
  onSwitchHousehold,
  hasPendingConnectionRequest = false,
}: DashboardProps) {
  const householdQuery = usePilotHousehold(userId);
  const householdId = householdQuery.data?.household_id ?? userId;
  const snapshotQuery = useHouseholdSnapshot(householdId);
  const decisionQuery = useLatestDecision(householdId);

  const loading = householdQuery.loading || snapshotQuery.loading || decisionQuery.loading;
  const queryError = householdQuery.error?.message ?? snapshotQuery.error?.message ?? decisionQuery.error?.message;

  const household = householdQuery.data;
  const snapshot = snapshotQuery.data;
  const decision = decisionQuery.data;

  const refetchAll = () => { householdQuery.refetch(); snapshotQuery.refetch(); decisionQuery.refetch(); };

  // === NEW: Check Supabase for pending connection request (persistent) ===
  const [hasPendingFromDb, setHasPendingFromDb] = useState(false);

  useEffect(() => {
    if (!householdId) return;

    const checkPendingRequest = async () => {
      const { data, error } = await supabase
        .from("pilot_connection_requests")
        .select("id")
        .eq("household_id", householdId)
        .eq("status", "pending_review")
        .limit(1);

      if (!error && data && data.length > 0) {
        setHasPendingFromDb(true);
      } else {
        setHasPendingFromDb(false);
      }
    };

    checkPendingRequest();
  }, [householdId]);

  // Merge optimistic prop (from App after submit) with DB result
  const effectivePending = hasPendingConnectionRequest || hasPendingFromDb;

  if (loading && !snapshot && !household && !decision) return <LoadingState />;

  const mode = snapshot?.mode ?? decision?.mode ?? "—";
  const reason = snapshot?.reason ?? decision?.reason ?? "No decision recorded";
  const dataSource = snapshot?.data_source ?? "simulated";

  const proposedMode = decision?.reasoning?.proposal?.mode;
  const finalMode = decision?.reasoning?.final?.mode ?? decision?.mode;
  const harmonyInfluenced = decision?.harmony_influenced ?? false;
  const tomorrowIrradiance = decision?.tomorrow_irradiance_kwh_m2 ?? decision?.reasoning?.weather?.tomorrow_irradiance_kwh_m2;
  const lowSolar = decision?.reasoning?.weather?.low_solar_forecast ?? false;

  const modeContextLine = buildModeContextLine(decision ?? undefined, reason);
  const friendlyReason = buildFriendlyReason(reason, String(mode));

  return (
    <div className="space-y-6 bg-slate-950 p-6 text-slate-100">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-emerald-400">Aussie Grid Pilot Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">Mackay pilot — your home energy overview</p>
          {household && (
            <p className="mt-2 text-sm text-slate-300">
              {household.household_id}{household.is_test ? " · test home" : ""} · {household.status}{household.inverter_make ? ` · ${household.inverter_make}` : ""}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <DevHouseholdSwitcher currentId={userId} onSwitch={onSwitchHousehold} />

          <span className={`rounded-full px-3 py-1 text-xs font-medium ${dataSource === "supabase" ? "bg-emerald-900/60 text-emerald-300" : "bg-amber-900/40 text-amber-200"}`}>
            {dataSource === "supabase" ? "Live data" : "Sample data for now"}
          </span>

          <button onClick={refetchAll} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Refresh
          </button>

          {onOpenHelp && <button onClick={onOpenHelp} className="rounded-md border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">Help</button>}
          {onOpenProfile && <button onClick={onOpenProfile} className="rounded-md border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">Profile</button>}
          {onConnectInverter && <button onClick={onConnectInverter} className="rounded-md border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">Connect Inverter</button>}
          {onSignOut && <button onClick={onSignOut} className="rounded-md border border-red-600/60 px-3 py-2 text-sm text-red-400 hover:bg-red-950/40">Sign out</button>}
        </div>
      </header>

      {/* Soft warning if queries are failing (common with test households) */}
      {queryError && (
        <WarningBanner 
          message={`Data temporarily unavailable: ${queryError}. You can still connect your system below — this is normal for new pilot households.`} 
        />
      )}

      {/* Sungrow Connection Status — now uses effectivePending from DB + optimistic prop */}
      {household && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
          {household.sungrow_connected_at ? (
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-slate-200">Sungrow system connected</span>
              <span className="text-xs text-slate-500">since {new Date(household.sungrow_connected_at).toLocaleDateString()}</span>
            </div>
          ) : effectivePending ? (
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <div>
                <span className="text-sm font-medium text-amber-200">Connection request pending review</span>
                <p className="text-xs text-amber-300/80">Our team will activate read-only access within 1–2 business days</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-sm font-medium text-slate-200">Sungrow system not connected yet</span>
            </div>
          )}

          {!household.sungrow_connected_at && !effectivePending && onConnectInverter && (
            <button onClick={onConnectInverter} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors">
              Connect Sungrow
            </button>
          )}
        </div>
      )}

      <ReadOnlyPilotBanner />
      <WelcomePilotOverview />

      <ConnectYourSystemPrompt
        inverterMake={household?.inverter_make}
        isConnected={!!household?.sungrow_connected_at}
        onConnect={onConnectInverter}
      />

      <NextStepsSection
        isConnected={!!household?.sungrow_connected_at}
        onConnect={onConnectInverter}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CurrentModeCard mode={String(mode)} reason={friendlyReason} contextLine={modeContextLine} />
        <MetricCard label="Battery level" value={snapshot ? `${snapshot.battery_soc.toFixed(0)}%` : "Waiting for data"} hint={snapshot ? "How full your home battery is right now" : "Connect your system to see live values"} />
        <MetricCard label="Solar output" value={snapshot ? `${snapshot.solar_kw.toFixed(1)} kW` : "Waiting for data"} hint={snapshot ? "Power your panels are generating now" : undefined} />
        <MetricCard label="Grid flow" value={snapshot ? formatGridFlow(snapshot.grid_kw) : "Waiting for data"} hint={snapshot ? "Whether you're importing from or exporting to the grid" : undefined} />
      </section>

      <TomorrowOutlookSection tomorrowIrradiance={tomorrowIrradiance} lowSolar={lowSolar} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Home usage" value={snapshot ? `${snapshot.consumption_kw.toFixed(1)} kW` : "Waiting for data"} hint={snapshot ? "Power your home is using right now" : undefined} />
        <div className="flex flex-col sm:col-span-2 xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard label="Yesterday's savings" value={snapshot?.yesterday_savings_aud != null ? `$${snapshot.yesterday_savings_aud.toFixed(2)}` : "Not calculated yet"} hint="What the agent saved you compared to doing nothing" />
            <MetricCard label="Savings so far (pilot)" value={snapshot?.cumulative_savings_aud != null ? `$${snapshot.cumulative_savings_aud.toFixed(2)}` : "Not calculated yet"} hint="Total estimated savings since you joined the pilot" />
          </div>
          <SavingsTrendsPlaceholder />
        </div>
        <MetricCard label="Last updated" value={snapshot ? formatTimestamp(snapshot.last_updated) : "—"} hint={snapshot ? "When we last received data from your system" : undefined} />
      </section>

      <OperatingModesSection activeMode={String(mode)} />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-lg font-medium text-emerald-400">Today&apos;s energy decision</h2>
          {decision ? (
            <>
              <DecisionSummaryBlock decision={decision} />
              <dl className="mt-5 space-y-3 border-t border-slate-700/80 pt-4 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-slate-400">First suggestion</dt><dd>{formatModeLabel(String(proposedMode ?? mode))}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-400">Mode in use</dt><dd>{formatModeLabel(String(finalMode ?? mode))}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-400">How confident</dt><dd>{formatConfidence(decision.confidence)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-400">Safety check</dt><dd>{decision.verification_passed ? "Passed" : "Adjusted for safety"}{decision.severity && !decision.verification_passed ? ` (${decision.severity})` : ""}</dd></div>
                {decision.harmony_recommendation && <div className="flex justify-between gap-4"><dt className="text-slate-400">Coordinated with other homes</dt><dd>{formatHarmonyDetail(decision.harmony_recommendation)}{harmonyInfluenced ? " · affected today's mode" : ""}</dd></div>}
                <div><dt className="text-slate-400">Technical note</dt><dd className="mt-1 text-slate-200">{decision.reason}</dd></div>
              </dl>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400">
              No decision recorded yet. Connect your Sungrow system above and we’ll start learning from your home’s data.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-lg font-medium text-emerald-400">When today&apos;s decision was made</h2>
          <p className="mt-1 text-sm text-slate-500">Snapshot of your home at the time of the latest agent update.</p>
          <dl className="mt-4 space-y-3 text-sm">
            {decision?.reasoning?.context ? (
              <>
                <div className="flex justify-between gap-4"><dt className="text-slate-400">Battery level when decided</dt><dd>{decision.reasoning.context.battery_soc != null ? `${decision.reasoning.context.battery_soc}%` : "Not recorded"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-400">Solar when decided</dt><dd>{decision.reasoning.context.solar_power_w != null ? `${(decision.reasoning.context.solar_power_w / 1000).toFixed(1)} kW` : "Not recorded"}</dd></div>
              </>
            ) : (
              <p className="text-slate-500">No decision snapshot available yet. Connect your system to start seeing data.</p>
            )}
          </dl>
        </div>
      </section>

      {household && (
        <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-lg font-medium text-emerald-400">Your home details</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-400">Battery size</dt><dd>{household.battery_capacity_kwh != null ? `${household.battery_capacity_kwh} kWh` : "Not recorded yet"}</dd></div>
            <div><dt className="text-slate-400">Solar system size</dt><dd>{household.solar_kw != null ? `${household.solar_kw} kW` : "Not recorded yet"}</dd></div>
            <div><dt className="text-slate-400">Pilot consent</dt><dd>{household.consent_given ? "Confirmed" : "Still pending"}</dd></div>
            <div><dt className="text-slate-400">Notes</dt><dd>{household.onboarding_notes ?? "None"}</dd></div>
          </dl>
        </section>
      )}

      <AppVersionFooter />
    </div>
  );
}

export default Dashboard;