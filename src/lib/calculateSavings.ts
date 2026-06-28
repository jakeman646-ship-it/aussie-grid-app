/**
 * Real savings calculation for Neighbourhood Power pilot
 * Ergon Tariff 12D (TOU) + Feed-in Tariff
 * 
 * Clean, reliable version for pilot phase.
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

function getDateKey(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toISOString().split('T')[0];
}

export function calculateSavingsFromReadings(
  readings: Reading[],
  tariff: TariffRate = ERGON_TARIFF_12D,
  pilotDays: number = 11
): SavingsResult {
  if (!readings || readings.length < 4) {
    return {
      yesterdaySavings: 0,
      pilotProjectedTotal: 0,
      dailyAverage: 0,
      daysOfData: 0,
      periodLabel: "Collecting data",
      dataNote: "Waiting for more readings",
      breakdown: { avoidedImportCost: 0, actualGridCost: 0, exportRevenue: 0 },
    };
  }

  const sorted = [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const dailyMap = new Map<string, {
    selfConsumedKwh: number;
    exportedKwh: number;
    count: number;
  }>();

  const avgImportRate = (tariff.peak + tariff.shoulder + tariff.offpeak) / 3;

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const start = new Date(current.timestamp);
    const end = new Date(next.timestamp);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    if (hours <= 0 || hours > 2.5) continue;

    const avgSolar = ((current.solar_kw ?? 0) + (next.solar_kw ?? 0)) / 2;
    const avgGrid = (current.grid_kw + next.grid_kw) / 2;

    const solarKwh = avgSolar * hours;
    const gridExportKwh = Math.max(0, -avgGrid) * hours;

    // Self-consumed solar = solar produced minus what was exported
    const selfConsumedKwh = Math.max(0, solarKwh - gridExportKwh);

    const dateKey = getDateKey(current.timestamp);

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { selfConsumedKwh: 0, exportedKwh: 0, count: 0 });
    }

    const day = dailyMap.get(dateKey)!;
    day.selfConsumedKwh += selfConsumedKwh;
    day.exportedKwh += gridExportKwh;
    day.count += 1;
  }

  // Build daily results (lenient filter for pilot)
  const dailyResults = Array.from(dailyMap.entries())
    .map(([date, v]) => {
      const avoidedImportValue = v.selfConsumedKwh * avgImportRate;
      const exportValue = v.exportedKwh * tariff.fit;
      const savings = avoidedImportValue + exportValue;

      return {
        date,
        savings: Number(savings.toFixed(2)),
        readingCount: v.count,
      };
    })
    .filter(d => d.readingCount >= 4);

  if (dailyResults.length === 0) {
    return {
      yesterdaySavings: 0,
      pilotProjectedTotal: 0,
      dailyAverage: 0,
      daysOfData: 0,
      periodLabel: "Collecting data",
      dataNote: "Building baseline",
      breakdown: { avoidedImportCost: 0, actualGridCost: 0, exportRevenue: 0 },
    };
  }

  const daysOfData = dailyResults.length;
  const totalSavings = dailyResults.reduce((sum, d) => sum + d.savings, 0);
  const dailyAverage = Number((totalSavings / daysOfData).toFixed(2));

  const sortedDays = [...dailyResults].sort((a, b) => b.date.localeCompare(a.date));
  const yesterdaySavings = Math.max(0, sortedDays[0].savings);

  const pilotProjectedTotal = Number((dailyAverage * pilotDays).toFixed(2));

  let dataNote = "";
  if (daysOfData === 1) {
    dataNote = "Based on 1 day of data";
  } else if (daysOfData < 7) {
    dataNote = `Based on ${daysOfData} days of data`;
  } else {
    dataNote = `Based on ${daysOfData} days of pilot data`;
  }

  return {
    yesterdaySavings: Number(yesterdaySavings.toFixed(2)),
    pilotProjectedTotal,
    dailyAverage,
    daysOfData,
    periodLabel: daysOfData === 1 ? "Last day" : "Daily average × pilot days",
    dataNote,
    breakdown: {
      avoidedImportCost: Number(totalSavings.toFixed(2)),
      actualGridCost: 0,
      exportRevenue: 0,
    },
  };
}