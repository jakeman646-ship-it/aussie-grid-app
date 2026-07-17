/**
 * Aussie Grid — Energy Systems empty / not-configured guidance
 * File: src/components/energySystem/EnergySystemsEmptyState.tsx
 * Version: v0.1.0
 * Updated: 18 Jul 2026
 *
 * Read-only helper shown when the household has no configured energy system
 * with a usable data path. Non-intrusive; no writes or control.
 */
export function EnergySystemsEmptyState({
  variant = "full",
}: {
  /** `full` = no OEM cards; `compact` = OEM strips present but none configured */
  variant?: "full" | "compact";
}) {
  const isFull = variant === "full";

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
