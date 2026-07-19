/**
 * Aussie Grid — Energy Systems empty / not-configured guidance
 * File: src/components/energySystem/EnergySystemsEmptyState.tsx
 * Version: v0.3.0
 * Updated: 19 Jul 2026 — warmer preparing-data copy for customerFacing
 *
 * Read-only helper shown when the household has no configured energy system
 * with a usable data path. Non-intrusive; no writes or control.
 */
export function EnergySystemsEmptyState({
  variant = "full",
  customerFacing = false,
}: {
  /** `full` = no OEM cards; `compact` = OEM strips present but none configured */
  variant?: "full" | "compact";
  /** Hide ops/docs language (admin impersonation / household demo). */
  customerFacing?: boolean;
}) {
  const isFull = variant === "full";

  if (customerFacing) {
    return (
      <div
        role="status"
        className={
          isFull
            ? "rounded-lg border border-dashed border-emerald-700/35 bg-emerald-950/15 px-4 py-5"
            : "rounded-lg border border-emerald-800/30 bg-emerald-950/10 px-3.5 py-3"
        }
      >
        <p className="text-sm font-semibold text-emerald-200/95">
          {isFull ? "Connecting your energy system" : "Preparing connection status"}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
          We&apos;re setting up honest status for your inverter and battery. Live connection
          details appear after the first successful data pull — we never show{" "}
          <span className="text-slate-200">Connected</span> until data actually flows.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Monitoring only during the pilot read-only period. If you still need to submit access
          details, use <span className="text-slate-300">Connect Inverter</span> above.
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={
        isFull
          ? "rounded-lg border border-dashed border-slate-600/70 bg-slate-900/50 px-4 py-5"
          : "rounded-lg border border-slate-700/50 bg-slate-950/40 px-3.5 py-3"
      }
    >
      <p
        className={
          isFull
            ? "text-sm font-semibold text-slate-200"
            : "text-xs font-semibold uppercase tracking-wide text-slate-400"
        }
      >
        {isFull ? "No energy system linked yet" : "Systems listed — none configured"}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
        This section shows honest connection status for inverters and batteries (Sigenergy
        today; Sungrow / Tesla next). <span className="text-slate-300">Connected</span> only
        after a usable data pull — never from Accept alone. Monitoring only; no agent control
        from here.
      </p>

      <ol className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-400">
        <li>
          <span className="font-medium text-slate-300">1.</span> Get the Sigenergy{" "}
          <span className="font-mono text-[11px] text-slate-300">systemId</span> from mySigen →
          Settings → Basic Info (owner Accept required for data to flow).
        </li>
        <li>
          <span className="font-medium text-slate-300">2.</span> Link it to this household
          (ops / onboard), then use <span className="text-slate-300">Run Validation</span> for a
          read-only dry-run.
        </li>
        <li>
          <span className="font-medium text-slate-300">3.</span> First live ingest stays
          CTO-gated — see the First Run checklist.
        </li>
      </ol>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        <span className="font-medium text-slate-400">Docs (backend/ingest): </span>
        FIRST_RUN_CHECKLIST.md · FIRST_SIGENERGY_REAL_RUN.md · SIGENERGY_QUICK_COMMANDS.md ·
        SIGENERGY_INGESTION_GUIDELINES.md
      </p>
    </div>
  );
}
