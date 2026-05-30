import { ModeCard } from "@/components/ModeCard";
import { useAuth } from "@/hooks/useAuth";
import type { OperatingModeInfo } from "@/types/operating-mode";

const operatingModes: OperatingModeInfo[] = [
  {
    id: "storm",
    name: "Storm",
    tagline: "Ride out the next big one",
    description:
      "Pre-charge home batteries ahead of severe weather and prioritise critical loads when the grid wobbles.",
    accent: "navy",
  },
  {
    id: "save",
    name: "Save",
    tagline: "Lower your power bill",
    description:
      "Shift consumption away from peak tariffs and squeeze the most value out of your rooftop solar.",
    accent: "energy",
  },
  {
    id: "sell",
    name: "Sell",
    tagline: "Earn from your battery",
    description:
      "Export to the wholesale market when prices spike — the VPP handles the trading on your behalf.",
    accent: "energy",
  },
  {
    id: "holiday",
    name: "Holiday",
    tagline: "Set and forget",
    description:
      "Heading away from Mackay? Lean defaults that keep your home safe and your battery topped up.",
    accent: "navy",
  },
];

export function DashboardPage() {
  const { user } = useAuth();

  const greetingName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "neighbour";

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-energy">
          Welcome back
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
          G'day, {greetingName} 
        </h1>
        <p className="mt-2 max-w-2xl text-base text-navy-400">
          Your Aussie Grid dashboard is your home base for the Mackay VPP pilot.
          Soon you'll be able to switch between operating modes, see live energy
          flows, and track community impact in real time.
        </p>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-navy">
              Operating modes
            </h2>
            <p className="mt-1 text-sm text-navy-400">
              Choose how your home participates in the grid. More modes are
              rolling out through the pilot.
            </p>
          </div>
          <span className="hidden rounded-full bg-energy/10 px-3 py-1 text-xs font-semibold text-energy-600 sm:inline">
            Pilot · Mackay QLD
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {operatingModes.map((mode) => (
            <ModeCard key={mode.id} mode={mode} />
          ))}
        </div>
      </section>

      <section className="card flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-navy">Help shape the pilot</h3>
          <p className="mt-1 max-w-xl text-sm text-navy-400">
            Aussie Grid is built with — not just for — the Mackay community.
            Share feedback, suggest features, or volunteer to host a test site.
          </p>
        </div>
        <button type="button" className="btn-secondary whitespace-nowrap">
          Get involved
        </button>
      </section>
    </div>
  );
}
