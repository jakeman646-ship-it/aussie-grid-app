import type { OperatingModeInfo } from "@/types/operating-mode";
import { cn } from "@/lib/cn";

interface ModeCardProps {
  mode: OperatingModeInfo;
}

const accentClasses: Record<OperatingModeInfo["accent"], string> = {
  navy: "bg-navy text-white",
  energy: "bg-energy text-white",
};

const iconMap: Record<OperatingModeInfo["id"], string> = {
  storm:
    "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  save: "M12 3v18m-7-9h14",
  sell: "M3 12h18M12 3l9 9-9 9",
  holiday: "M12 3v18M5 12a7 7 0 0 1 14 0",
};

export function ModeCard({ mode }: ModeCardProps) {
  return (
    <article className="card group flex h-full flex-col gap-4 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "grid h-10 w-10 place-items-center rounded-lg",
            accentClasses[mode.accent],
          )}
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d={iconMap[mode.id]} />
          </svg>
        </span>
        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
          Coming soon
        </span>
      </div>

      <div>
        <h3 className="text-lg font-bold tracking-tight text-navy">
          {mode.name}
        </h3>
        <p className="mt-0.5 text-sm font-medium text-energy-500">
          {mode.tagline}
        </p>
      </div>

      <p className="text-sm leading-relaxed text-navy-400">
        {mode.description}
      </p>

      <div className="mt-auto pt-2">
        <button
          type="button"
          disabled
          className="btn w-full border border-slate-200 bg-white text-navy-300"
        >
          Configure
        </button>
      </div>
    </article>
  );
}
