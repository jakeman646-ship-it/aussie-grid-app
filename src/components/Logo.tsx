import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
  variant?: "light" | "dark";
}

export function Logo({ className, variant = "dark" }: LogoProps) {
  const textColor = variant === "light" ? "text-white" : "text-navy";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-lg bg-navy text-white shadow-soft"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5 text-energy"
          stroke="currentColor"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
        </svg>
      </span>
      <span className={cn("flex flex-col leading-tight", textColor)}>
        <span className="text-sm font-extrabold tracking-tight">
          Aussie Grid
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-energy">
          VPP Pilot · Mackay
        </span>
      </span>
    </div>
  );
}
