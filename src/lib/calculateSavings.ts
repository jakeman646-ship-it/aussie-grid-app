/**
 * Real savings calculation for Neighbourhood Power pilot
 * Uses Ergon Tariff 12D (TOU) + current feed-in tariff
 * 
 * Improved version with daily aggregation + honest projections
 */

export type TariffRate = {
  peak: number;
  shoulder: number;
  offpeak: number;
  fit: number;
};

export const ERGON_TARIFF_12D: TariffRate = {
  peak: 0.40651,
  shoulder: 0.25044,
  offpeak: 0.18512,
  fit: 0.06006,
};

export type Reading = {
  timestamp: string;
  consumption_kw: number;
  grid_kw: number;
  solar_kw?: number;
  battery_power_kw?: number;
};

export type DailySavings = {
  date: string;           // YYYY-MM-DD
  savings: number;
  importCost: number;
  exportRevenue: number;
};

export type SavingsResult = {
  yesterdaySavings: number;
  pilotProjectedTotal: number;
  dailyAverage: number;
  daysOfData: number;
  periodLabel: string;
  dataNote: string;
  breakdown: {
    avoidedImportCost: number;
    actualGridCost: number;
    exportRevenue: number;
  };
};

function getTouPeriod(hour: number): 'peak' | 'shoulder' | 'offpeak' {
  if (hour >= 16 && hour < 21) return 'peak';
  if (hour >= 11 && hour < 16) return 'offpeak';
  return 'shoulder';
}

function getDateKey(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD in UTC (good enough for now)
}

/**
 * Calculate real savings with daily aggregation.
 */
export function calculateSavingsFromReadings(
  readings: Reading[],
  tariff: TariffRate = ERGON_TARIFF_12D,
  pilotDays: number = 11
): SavingsResult {
  if (!readings || readings.length === 0) {
    return {
      yesterdaySavings: 0,
      pilotProjectedTotal: 0,
      dailyAverage: 0,
      daysOfData: 0,
      periodLabel: "No data yet",
      dataNote: "Connect your system to start seeing real savings",
      breakdown: { avoidedImportCost: 0, actualGridCost: 0, exportRevenue: 0 },
    };
  }

  const sorted = [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Group by calendar day
  const dailyMap = new Map<string, { avoided: number; actual: number; export: number }>();

  for (const r of sorted) {
    const dateKey = getDateKey(r.timestamp);
    const hour = new Date(r.timestamp).getHours();
    const period = getTouPeriod(hour);
    const rate = period === 'peak' ? tariff.peak : period === 'offpeak' ? tariff.offpeak : tariff.shoulder;

    const consumptionKwh = Math.max(0, r.consumption_kw);
    const gridImportKwh = Math.max(0, r.grid_kw);
    const gridExportKwh = Math.max(0, -r.grid_kw);

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { avoided: 0, actual: 0, export: 0 });
    }
    const day = dailyMap.get(dateKey)!;
    day.avoided += consumptionKwh * rate;
    day.actual += gridImportKwh * rate;
    day.export += gridExportKwh * tariff.fit;
  }

  // Convert to array and calculate daily savings
  const dailySavings: DailySavings[] = Array.from(dailyMap.entries()).map(([date, v]) => ({
    date,
    savings: Number((v.avoided - v.actual + v.export).toFixed(2)),
    importCost: Number(v.actual.toFixed(2)),
    exportRevenue: Number(v.export.toFixed(2)),
  }));

  const daysOfData = dailySavings.length;
  const totalSavings = dailySavings.reduce((sum, d) => sum + d.savings, 0);
  const dailyAverage = daysOfData > 0 ? Number((totalSavings / daysOfData).toFixed(2)) : 0;

  // "Yesterday" = most recent full day in the data
  const sortedDays = [...dailySavings].sort((a, b) => b.date.localeCompare(a.date));
  const yesterdaySavings = sortedDays.length > 0 ? sortedDays[0].savings : 0;

  // Pilot projection
  const pilotProjectedTotal = Number((dailyAverage * pilotDays).toFixed(2));

  let dataNote = "";
  if (daysOfData === 1) {
    dataNote = "Based on 1 day of data — projection only";
  } else if (daysOfData < 7) {
    dataNote = `Based on ${daysOfData} days of data`;
  } else {
    dataNote = `Based on ${daysOfData} days of pilot data`;
  }

  return {
    yesterdaySavings,
    pilotProjectedTotal,
    dailyAverage,
    daysOfData,
    periodLabel: daysOfData === 1 ? "Last full day of data" : "Daily average × pilot days",
    dataNote,
    breakdown: {
      avoidedImportCost: Number(totalSavings.toFixed(2)),
      actualGridCost: 0,
      exportRevenue: 0,
    },
  };
}