/**
 * Aussie Grid — Agent Control Banner
 * File: src/components/AgentControlBanner.tsx
 * Version: v0.1.2.20
 * Updated: 24 Jul 2026 — block activate while impersonating (security 4).
 */
import { useState } from "react";
import { activateAgentControl } from "@/lib/api/activateAgentControl";
import type { AgentControlMode } from "@/types/agentControl";
import { agentControlLabel } from "@/types/agentControl";

export interface AgentControlBannerProps {
  householdId: string;
  mode: AgentControlMode;
  isConnected: boolean;
  /** When true, view-only — no UPDATE pilot_households (matches useOutcomeRanks). */
  isImpersonating?: boolean;
  onActivated?: () => void;
}

export function AgentControlBanner({
  householdId,
  mode,
  isConnected,
  isImpersonating = false,
  onActivated,
}: AgentControlBannerProps) {
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const isSuggestOnly = mode !== "agent_control";
  /** Impersonation or missing id — no writes (same idea as useOutcomeRanks.isReadOnly). */
  const isWriteBlocked = isImpersonating || !householdId.trim();

  const handleActivate = async () => {
    if (isWriteBlocked) {
      setError("Agent control can't be changed while viewing another household.");
      setShowConfirm(false);
      return;
    }

    setActivating(true);
    setError(null);
    try {
      await activateAgentControl(householdId, { isImpersonating });
      setShowConfirm(false);
      onActivated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate agent control");
    } finally {
      setActivating(false);
    }
  };

  if (!isSuggestOnly) {
    return (
      <div role="status" className="rounded-lg border border-emerald-500/50 bg-emerald-950/30 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-300">{agentControlLabel(mode)}</p>
            <p className="mt-1 text-sm leading-relaxed text-emerald-100/90">
              Your smart agent is running in <strong className="font-medium">full control</strong> mode.
              It can set operating modes on your inverter to help reduce your Ergon bill.
              Every decision is logged here so you can see what changed and why.
            </p>
            {isWriteBlocked && (
              <p className="mt-2 text-sm text-amber-200/90">View only while impersonating</p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-emerald-600/30 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-500/40">
            Live control
          </span>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="rounded-lg border border-sky-600/40 bg-sky-950/20 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-sky-300">{agentControlLabel(mode)}</p>
          <p className="mt-1 text-sm leading-relaxed text-sky-100/90">
            Your agent is in <strong className="font-medium">read-only</strong> mode right now.
            It studies your solar and battery data and suggests the best operating mode each day —
            but it <em>cannot</em> change any settings on your inverter until you opt in.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-sky-100/80">
            When you&apos;re ready, activate agent control to let the agent apply modes automatically
            and start saving on your bill.
          </p>
          {isWriteBlocked && (
            <p className="mt-2 text-sm text-amber-200/90">View only while impersonating</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-sky-900/60 px-3 py-1 text-xs font-medium uppercase tracking-wide text-sky-300 ring-1 ring-sky-600/40">
          Suggest only
        </span>
      </div>

      {isConnected && !isWriteBlocked && (
        <div className="mt-4 border-t border-sky-700/30 pt-4">
          {!showConfirm ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Activate Agent Control
            </button>
          ) : (
            <div className="rounded-lg border border-amber-600/40 bg-amber-950/30 px-4 py-3">
              <p className="text-sm font-medium text-amber-200">Confirm activation</p>
              <p className="mt-1 text-sm text-amber-100/90">
                The agent will be able to set operating modes on your{" "}
                {householdId.includes("tesla") ? "Tesla" : "inverter"} system.
                You can review every decision on this dashboard.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={activating}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {activating ? "Activating…" : "Yes, activate agent control"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  disabled={activating}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!isConnected && !isWriteBlocked && (
        <p className="mt-3 text-xs text-sky-400/80">
          Connect your inverter first — agent control becomes available once your system is live.
        </p>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}

export default AgentControlBanner;
