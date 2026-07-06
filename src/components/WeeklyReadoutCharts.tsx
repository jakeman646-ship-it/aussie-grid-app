/**
 * Weekly Readout Charts — savings opportunities + projected bill reduction
 * File: src/components/WeeklyReadoutCharts.tsx
 * Version: v0.1.2.18
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { WeeklyReadout } from "@/types/pilotConfig";

const OPP_COLORS = ["#22c55e", "#16a34a", "#4ade80", "#86efac", "#bbf7d0"];

interface WeeklyReadoutChartsProps {
  readout: WeeklyReadout | null;
  loading?: boolean;
}

function formatAud(value: number): string {
  return `$${value.toFixed(2)}`;
}

function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-sm shadow-xl">
      <p className="font-medium text-emerald-400">{label}</p>
      <p className="text-slate-200">{formatAud(payload[0].value)}</p>
    </div>
  );
}

function CustomPieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { description?: string } }[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="max-w-xs rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-sm shadow-xl">
      <p className="font-medium text-emerald-400">{item.name}</p>
      <p className="text-slate-200">{formatAud(item.value)}</p>
      {item.payload.description && <p className="mt-1 text-xs text-slate-400">{item.payload.description}</p>}
    </div>
  );
}

export function WeeklyReadoutCharts({ readout, loading }: WeeklyReadoutChartsProps) {
  if (loading) {
    return (
      <div className="mt-4 rounded-md bg-slate-900/60 px-3 py-4 text-sm text-slate-400">
        Loading weekly readout…
      </div>
    );
  }

  if (!readout) {
    return (
      <div className="mt-4 rounded-md bg-slate-900/60 px-3 py-4 text-sm text-slate-400">
        Weekly readout will appear here once the agent has compiled a full week of savings data.
      </div>
    );
  }

  const dailyData = (readout.daily_breakdown ?? []).map((d) => ({
    date: d.date.slice(5),
    savings: d.savings_aud,
  }));

  const oppData = (readout.savings_opportunities ?? []).filter((o) => o.potential_aud > 0);

  const projectionData = [
    { period: "This week", amount: readout.total_savings_aud },
    { period: "Monthly (est.)", amount: readout.projected_monthly_bill_reduction_aud },
    { period: "Annual (est.)", amount: readout.projected_annual_bill_reduction_aud },
  ];

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-emerald-300">Weekly readout</p>
        <span className="text-xs text-slate-500">
          {readout.week_start} → {readout.week_end}
        </span>
      </div>

      {readout.agent_summary && (
        <p className="text-sm leading-relaxed text-slate-300">{readout.agent_summary}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Daily savings</p>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="savings" fill="#22c55e" radius={[4, 4, 0, 0]} name="Savings" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">No daily data yet</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Savings opportunities</p>
          {oppData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={oppData}
                  dataKey="potential_aud"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {oppData.map((_, i) => (
                    <Cell key={i} fill={OPP_COLORS[i % OPP_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">Opportunities will appear with more data</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-emerald-800/30 bg-emerald-950/20 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-400/80">Projected bill reduction</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={projectionData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
            <YAxis type="category" dataKey="period" width={100} tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip content={<CustomBarTooltip />} />
            <Bar dataKey="amount" fill="#16a34a" radius={[0, 4, 4, 0]} name="Reduction" />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs text-slate-500">
          Projections extrapolate your average daily savings ({formatAud(readout.avg_daily_savings_aud)}/day) — not a guarantee.
        </p>
      </div>
    </div>
  );
}

export default WeeklyReadoutCharts;
