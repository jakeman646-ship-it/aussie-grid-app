import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Reading {
  timestamp: string;
  solar_kw?: number;
  consumption_kw?: number;
  grid_kw?: number;
  battery_power_kw?: number; // positive = charging, negative = discharging
}

interface EnergyReadingsChartProps {
  readings: Reading[];
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const time = new Date(label).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-4 py-3 text-sm shadow-xl">
      <p className="mb-2 font-medium text-emerald-400">{time}</p>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => {
          const value = entry.value;
          const formatted = value != null ? value.toFixed(2) : '—';
          const unit = 'kW';
          let label = entry.name;
          
          if (entry.dataKey === 'grid_kw') {
            label = value >= 0 ? 'Grid import' : 'Grid export';
          }
          if (entry.dataKey === 'battery_power_kw') {
            label = value >= 0 ? 'Battery charging' : 'Battery discharging';
          }

          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-slate-300">
                <span 
                  className="inline-block h-2.5 w-2.5 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                {label}
              </span>
              <span className="font-mono text-slate-100">
                {formatted} {unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EnergyReadingsChart({ readings }: EnergyReadingsChartProps) {
  if (!readings || readings.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-8 text-center">
        <p className="text-slate-400">No energy readings available yet.</p>
        <p className="mt-1 text-xs text-slate-500">Data will appear here once your system is connected and sending readings.</p>
      </div>
    );
  }

  // Sort + take last 24h worth of data (defensive)
  const sorted = [...readings].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Filter to last ~24 hours if we have more
  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
  const filtered = sorted.filter(r => new Date(r.timestamp).getTime() >= twentyFourHoursAgo);

  const chartData = filtered.map((r) => ({
    timestamp: r.timestamp,
    solar_kw: r.solar_kw ?? 0,
    consumption_kw: r.consumption_kw ?? 0,
    grid_kw: r.grid_kw ?? 0,
    battery_power_kw: r.battery_power_kw ?? 0,
  }));

  const lastReading = chartData[chartData.length - 1];

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-emerald-400">Last 24 Hours — Power Flows</h3>
          <p className="text-xs text-slate-500">
            {lastReading ? `Last updated ${formatTime(lastReading.timestamp)}` : 'Live data'}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>Solar • Consumption • Grid • Battery</div>
          <div className="text-[10px]">+ = export / charging &nbsp;&nbsp; − = import / discharging</div>
        </div>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatTime}
              stroke="#64748b"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            
            <YAxis 
              stroke="#64748b" 
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}`}
              label={{ 
                value: 'Power (kW)', 
                angle: -90, 
                position: 'insideLeft', 
                style: { fill: '#64748b', fontSize: 11 } 
              }}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend 
              verticalAlign="top" 
              height={36}
              iconType="plainline"
              formatter={(value) => {
                if (value === 'solar_kw') return 'Solar';
                if (value === 'consumption_kw') return 'Consumption';
                if (value === 'grid_kw') return 'Grid';
                if (value === 'battery_power_kw') return 'Battery';
                return value;
              }}
            />

            {/* Solar - emerald */}
            <Line 
              type="natural" 
              dataKey="solar_kw" 
              stroke="#10b981" 
              strokeWidth={2.5} 
              dot={false} 
              activeDot={{ r: 4, fill: '#10b981' }}
              name="Solar"
            />

            {/* Consumption - amber */}
            <Line 
              type="natural" 
              dataKey="consumption_kw" 
              stroke="#f59e0b" 
              strokeWidth={2.5} 
              dot={false} 
              activeDot={{ r: 4, fill: '#f59e0b' }}
              name="Consumption"
            />

            {/* Grid - sky (positive = import, negative = export) */}
            <Line 
              type="natural" 
              dataKey="grid_kw" 
              stroke="#38bdf8" 
              strokeWidth={2} 
              dot={false} 
              activeDot={{ r: 4, fill: '#38bdf8' }}
              name="Grid"
            />

            {/* Battery power - violet */}
            <Line 
              type="natural" 
              dataKey="battery_power_kw" 
              stroke="#a78bfa" 
              strokeWidth={2} 
              dot={false} 
              activeDot={{ r: 4, fill: '#a78bfa' }}
              name="Battery"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-center text-[10px] text-slate-500">
        Positive grid = importing from grid &nbsp;&nbsp;|&nbsp;&nbsp; Negative grid = exporting to grid<br />
        Positive battery = charging &nbsp;&nbsp;|&nbsp;&nbsp; Negative battery = discharging
      </p>
    </div>
  );
}

export default EnergyReadingsChart;