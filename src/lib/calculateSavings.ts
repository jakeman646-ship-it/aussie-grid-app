/**
 * Real savings calculation for Neighbourhood Power pilot
 * Uses Ergon Tariff 12D (TOU) + current feed-in tariff
 * 
 * Properly calculates energy (kWh) between readings using time deltas.
 * Improved "yesterday" detection + basic data quality filtering.
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
  date: string;
  savings: number;
  importCost: number;
  exportRevenue: number;
  readingCount: number;
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
  return d.toISOString().split('T')[0];
}

export function calculateSavingsFromReadings(
  readings: Reading[],
  tariff: TariffRate = ERGON_TARIFF_12D,
  pilotDays: number = 11
): SavingsResult {
  if (!readings || readings.length < 2) {
    return {
      yesterdaySavings: 0,
      pilotProjectedTotal: 0,
      dailyAverage: 0,
      daysOfData: 0,
      periodLabel: "Insufficient data",
      dataNote: "Need at least 2 readings to calculate savings",
      breakdown: { avoidedImportCost: 0, actualGridCost: 0, exportRevenue: 0 },
    };
  }

  const sorted = [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const dailyMap = new Map<string, { avoided: number; actual: number; export: number; count: number }>();

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const start = new Date(current.timestamp);
    const end = new Date(next.timestamp);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    // Skip large gaps (> 3 hours) and invalid intervals
    if (hours <= 0 || hours > 3) continue;

    const avgConsumption = (current.consumption_kw + next.consumption_kw) / 2;
    const avgGrid = (current.grid_kw + next.grid_kw) / 2;

    const consumptionKwh = avgConsumption * hours;
    const gridImportKwh = Math.max(0, avgGrid) * hours;
    const gridExportKwh = Math.max(0, -avgGrid) * hours;

    const hour = start.getHours();
    const period = getTouPeriod(hour);
    const rate = period === 'peak' ? tariff.peak : period === 'offpeak' ? tariff.offpeak : tariff.shoulder;

    const dateKey = getDateKey(current.timestamp);

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { avoided: 0, actual: 0, export: 0, count: 0 });
    }
    const day = dailyMap.get(dateKey)!;
    day.avoided += consumptionKwh * rate;
    day.actual += gridImportKwh * rate;
    day.export += gridExportKwh * tariff.fit;
    day.count += 1;
  }

  // Only include days that have a reasonable number of intervals (at least ~8 readings)
  const dailySavings: DailySavings[] = Array.from(dailyMap.entries())
    .map(([date, v]) => ({
      date,
      savings: Number((v.avoided - v.actual + v.export).toFixed(2)),
      importCost: Number(v.actual.toFixed(2)),
      exportRevenue: Number(v.export.toFixed(2)),
      readingCount: v.count,
    }))
    .filter(d => d.readingCount >= 8);

  if (dailySavings.length === 0) {
    return {
      yesterdaySavings: 0,
      pilotProjectedTotal: 0,
      dailyAverage: 0,
      daysOfData: 0,
      periodLabel: "Insufficient complete days",
      dataNote: "Not enough complete days of data yet",
      breakdown: { avoidedImportCost: 0, actualGridCost: 0, exportRevenue: 0 },
    };
  }

  const daysOfData = dailySavings.length;
  const totalSavings = dailySavings.reduce((sum, d) => sum + d.savings, 0);
  const dailyAverage = Number((totalSavings / daysOfData).toFixed(2));

  // "Yesterday" = most recent day with sufficient data
  const sortedDays = [...dailySavings].sort((a, b) => b.date.localeCompare(a.date));
  const yesterdaySavings = sortedDays[0].savings;

  const pilotProjectedTotal = Number((dailyAverage * pilotDays).toFixed(2));

  let dataNote = "";
  if (daysOfData === 1) {
    dataNote = "Based on 1 complete day of data";
  } else if (daysOfData < 7) {
    dataNote = `Based on ${daysOfData} complete days of data`;
  } else {
    dataNote = `Based on ${daysOfData} days of pilot data`;
  }

  return {
    yesterdaySavings,
    pilotProjectedTotal,
    dailyAverage,
    daysOfData,
    periodLabel: daysOfData === 1 ? "Last complete day" : "Daily average × pilot days",
    dataNote,
    breakdown: {
      avoidedImportCost: Number(totalSavings.toFixed(2)),
      actualGridCost: 0,
      exportRevenue: 0,
    },
  };
}