/**
 * Aussie Grid — Energy system status presentation helpers
 * File: src/components/energySystem/statusPresentation.ts
 * Version: v0.2.0
 * Updated: 1 Aug 2026 — reading freshness + Monitoring · read-only label
 *
 * Shared badge styles + overview visibility rules for OEM status cards.
 * Adapters (SigenergyConnectionStatus, future Sungrow/Tesla) reuse these
 * so Dashboard behaviour stays consistent.
 */

import type {
  EnergySystemConnectionStatus,
  EnergySystemOemId,
  EnergySystemStatusPresentation,
  EnergySystemStatusVariant,
} from "@/types/energySystemStatus";

/** Fresh household_readings window for Sungrow "monitoring live" (2 hours). */
export const READING_FRESH_MS = 2 * 60 * 60 * 1000;

/** True when lastReadingAt is a real timestamp within the freshness window. */
export function isHouseholdReadingFresh(
  lastReadingAt: string | null | undefined,
  nowMs: number = Date.now(),
  windowMs: number = READING_FRESH_MS,
): boolean {
  if (!lastReadingAt) return false;
  const t = Date.parse(lastReadingAt);
  if (!Number.isFinite(t)) return false;
  const age = nowMs - t;
  return age >= 0 && age <= windowMs;
}

/** Default badge / ring styles for the three honest connection states. */
export const ENERGY_SYSTEM_STATUS_STYLES: Record<
  EnergySystemConnectionStatus,
  EnergySystemStatusPresentation
> = {
  connected: {
    label: "Connected",
    badgeClass: "bg-emerald-600/30 text-emerald-300 ring-1 ring-emerald-500/40",
    dotClass: "bg-emerald-500",
    ringClass: "border-emerald-700/50",
  },
  data_not_ready: {
    label: "Preparing data",
    badgeClass: "bg-amber-900/60 text-amber-200 ring-1 ring-amber-600/40",
    dotClass: "bg-amber-500",
    ringClass: "border-amber-700/40",
  },
  not_configured: {
    label: "Not Configured",
    badgeClass: "bg-slate-800 text-slate-300 ring-1 ring-slate-600/50",
    dotClass: "bg-slate-500",
    ringClass: "border-slate-700/80",
  },
};

/**
 * Household-facing badge text. Readings-backed "connected" → Monitoring · read-only
 * (never implies agent control or retailer bill).
 */
export function energySystemStatusLabel(
  status: EnergySystemConnectionStatus,
  opts?: { customerFacing?: boolean; fromLiveReadings?: boolean },
): string {
  if (
    status === "connected" &&
    (opts?.fromLiveReadings || opts?.customerFacing)
  ) {
    return "Monitoring · read-only";
  }
  return ENERGY_SYSTEM_STATUS_STYLES[status].label;
}

/**
 * Best-effort OEM guess from pilot_households.inverter_make.
 * Returns null when unknown — callers should not hide the card in that case.
 */
export function detectOemFromInverterMake(
  make: string | null | undefined,
): EnergySystemOemId | null {
  const m = (make || "").trim().toLowerCase();
  if (!m) return null;
  if (m.includes("sigenergy") || m.includes("sigen")) return "sigenergy";
  if (m.includes("sungrow") || m.includes("isolar")) return "sungrow";
  if (m.includes("tesla")) return "tesla";
  if (m.includes("fronius") || m.includes("enphase")) return "other";
  return null;
}

/**
 * Overview placement: hide this OEM card when the household clearly belongs
 * to a different brand and this OEM is not configured.
 *
 * Example: Tesla household → hide Sigenergy card; show Tesla card later.
 */
export function shouldHideOemCardOnOverview(opts: {
  variant: EnergySystemStatusVariant;
  status: EnergySystemConnectionStatus;
  /** External plant / system id for *this* OEM (e.g. Sigenergy systemId). */
  hasExternalId: boolean;
  inverterMake?: string | null;
  oemId: EnergySystemOemId;
}): boolean {
  if (opts.variant !== "overview") return false;
  if (opts.status !== "not_configured") return false;
  if (opts.hasExternalId) return false;

  const detected = detectOemFromInverterMake(opts.inverterMake);
  if (!detected) return false;
  return detected !== opts.oemId;
}

export function formatEnergyTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

export function formatKwh(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} kWh`;
}

export function formatSocPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(0)}%`;
}
