/**
 * Aussie Grid — Savings calculation
 * File: src/lib/calculateSavings.ts
 * Version: v0.1.2.17
 *
 * Ergon Tariff 12D TOU + FIT — mirrors services/savings_engine.py
 */
export const TARIFF_VERSION = "v2_tou_ergon_12d_household_readings";
const TIMEZONE = "Australia/Brisbane";
const EXPORT_RATE = 0.06006;

export type Reading = {
  timestamp: string;
  consumption_kw: number;
  grid_kw: number;
  solar_kw?: number;
  battery_power_kw?: number;
};

export type SavingsResult = {
  yesterdaySavings: number;
  cumulativeSavings: number;
  dailyAverage: number;
  daysOfData: number;
  periodLabel: string;
  dataNote: string;
  breakdown: {
    baselineCost: number;
    actualCost: number;
    savingsAud: number;
  };
};

type DailyTotals = {
  actualCost: number;
  baselineCost: number;
  intervalCount: number;
};

function formatBrisbaneDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(date);
}

function getBrisbaneTimeMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** Ergon 12D import rate ($/kWh) at a moment in Brisbane local time. */
export function getImportRate(timestamp: Date): number {
  const t = getBrisbaneTimeMinutes(timestamp);

  // Peak: 4pm–9pm
  if (t >= 16 * 60 && t < 21 * 60) return 0.40651;
  // Off-peak: 11am–4pm
  if (t >= 11 * 60 && t < 16 * 60) return 0.18512;
  // Night / shoulder: 9pm–11am
  return 0.25044;
}

function parseTimestamp(value: string): Date {
  return new Date(value);
}

function integrateInterval(current: Reading, next: Reading): {
  dateKey: string;
  actualCost: number;
  baselineCost: number;
} | null {
  const t0 = parseTimestamp(current.timestamp);
  const t1 = parseTimestamp(next.timestamp);
  const dtHours = (t1.getTime() - t0.getTime()) / (1000 * 60 * 60);

  if (dtHours <= 0 || dtHours > 2.5) return null;

  const gridKw = Number(current.grid_kw ?? 0);
  const batteryKw = Number(current.battery_power_kw ?? 0);
  const importKwh = Math.max(gridKw, 0) * dtHours;
  const exportKwh = Math.max(-gridKw, 0) * dtHours;
  const batteryDischargeKwh = Math.max(batteryKw, 0) * dtHours;
  const rate = getImportRate(t0);

  const actualCost = importKwh * rate - exportKwh * EXPORT_RATE;
  const baselineCost = (importKwh + batteryDischargeKwh) * rate;

  return {
    dateKey: formatBrisbaneDate(t0),
    actualCost,
    baselineCost,
  };
}

function buildDailyMap(readings: Reading[]): Map<string, DailyTotals> {
  const sorted = [...readings].sort(
    (a, b) => parseTimestamp(a.timestamp).getTime() - parseTimestamp(b.timestamp).getTime()
  );

  const dailyMap = new Map<string, DailyTotals>();

  for (let i = 0; i < sorted.length - 1; i++) {
    const interval = integrateInterval(sorted[i], sorted[i + 1]);
    if (!interval) continue;

    const existing = dailyMap.get(interval.dateKey) ?? {
      actualCost: 0,
      baselineCost: 0,
      intervalCount: 0,
    };

    existing.actualCost += interval.actualCost;
    existing.baselineCost += interval.baselineCost;
    existing.intervalCount += 1;
    dailyMap.set(interval.dateKey, existing);
  }

  return dailyMap;
}

export function calculateDailySavingsFromReadings(readings: Reading[]): Map<string, number> {
  const dailyMap = buildDailyMap(readings);
  const result = new Map<string, number>();

  for (const [date, totals] of dailyMap) {
    if (totals.intervalCount < 2) continue;
    const savings = totals.baselineCost - totals.actualCost;
    result.set(date, Number(Math.max(0, savings).toFixed(2)));
  }

  return result;
}

export function calculateSavingsFromReadings(readings: Reading[]): SavingsResult {
  const empty: SavingsResult = {
    yesterdaySavings: 0,
    cumulativeSavings: 0,
    dailyAverage: 0,
    daysOfData: 0,
    periodLabel: "Collecting data",
    dataNote: "Waiting for more readings",
    breakdown: { baselineCost: 0, actualCost: 0, savingsAud: 0 },
  };

  if (!readings || readings.length < 4) return empty;

  const dailyMap = buildDailyMap(readings);
  const dailyResults = Array.from(dailyMap.entries())
    .filter(([, v]) => v.intervalCount >= 2)
    .map(([date, v]) => ({
      date,
      savings: Number(Math.max(0, v.baselineCost - v.actualCost).toFixed(2)),
      baselineCost: v.baselineCost,
      actualCost: v.actualCost,
    }));

  if (dailyResults.length === 0) return empty;

  const daysOfData = dailyResults.length;
  const totalSavings = dailyResults.reduce((sum, d) => sum + d.savings, 0);
  const totalBaseline = dailyResults.reduce((sum, d) => sum + d.baselineCost, 0);
  const totalActual = dailyResults.reduce((sum, d) => sum + d.actualCost, 0);
  const dailyAverage = Number((totalSavings / daysOfData).toFixed(2));

  const sortedDays = [...dailyResults].sort((a, b) => b.date.localeCompare(a.date));
  const yesterdaySavings = sortedDays[0]?.savings ?? 0;
  const cumulativeSavings = Number(totalSavings.toFixed(2));

  let dataNote = "";
  if (daysOfData === 1) {
    dataNote = "Based on 1 day of data";
  } else if (daysOfData < 7) {
    dataNote = `Based on ${daysOfData} days of data`;
  } else {
    dataNote = `Based on ${daysOfData} days of pilot data`;
  }

  return {
    yesterdaySavings,
    cumulativeSavings,
    dailyAverage,
    daysOfData,
    periodLabel: daysOfData === 1 ? "Last complete day" : "Sum of available days",
    dataNote,
    breakdown: {
      baselineCost: Number(totalBaseline.toFixed(2)),
      actualCost: Number(totalActual.toFixed(2)),
      savingsAud: cumulativeSavings,
    },
  };
}

export function getYesterdayBrisbaneDate(): string {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return formatBrisbaneDate(yesterday);
}
