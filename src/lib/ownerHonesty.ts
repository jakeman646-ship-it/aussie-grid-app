/**
 * Aussie Grid — owner dashboard honesty helpers
 * File: src/lib/ownerHonesty.ts
 * Version: v0.1.0
 * Updated: 11 Oct 2026 — $ hint matches weekly report; 2h Live badge; no street in header
 */
import { isHouseholdReadingFresh } from "../components/energySystem/statusPresentation.ts";

/** Same wording as aussie-grid-backend services/weekly_report.py STARTER_DOLLAR_MODEL_NOTE. */
export const ESTIMATED_DOLLAR_SENTENCE =
  "Solar used in the house × Ergon 12D time-of-use. Sample-based from ~30-minute readings — not a meter total.";

function positive(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && value > 0;
}

/** Battery / feed-in are only named when that stored $ for the period is > 0. */
export function buildSavingsHint(stored: {
  batteryDischargeAud?: number | null;
  exportAud?: number | null;
}): string {
  const extras: string[] = [];
  if (positive(stored.batteryDischargeAud)) extras.push("battery discharge");
  if (positive(stored.exportAud)) extras.push("solar export at the feed-in tariff");
  if (extras.length === 0) return ESTIMATED_DOLLAR_SENTENCE;
  return `${ESTIMATED_DOLLAR_SENTENCE} Also includes ${extras.join(" and ")}.`;
}

export function formatReadingAge(lastReadingAt: string, nowMs: number = Date.now()): string {
  const t = Date.parse(lastReadingAt);
  if (!Number.isFinite(t)) return "Last reading time unknown";
  const minutes = Math.max(0, Math.floor((nowMs - t) / 60000));
  if (minutes < 60) return `Last reading ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Last reading ${hours} h ago`;
  return `Last reading ${Math.floor(hours / 24)} d ago`;
}

export type LiveBadgeState =
  | { kind: "live"; label: "Live data" }
  | { kind: "stale"; label: string }
  | { kind: "none" };

/** "Live data" only inside the same 2-hour window as Energy Systems. */
export function liveBadgeState(
  lastReadingAt: string | null | undefined,
  nowMs: number = Date.now(),
): LiveBadgeState {
  if (!lastReadingAt || !Number.isFinite(Date.parse(lastReadingAt))) return { kind: "none" };
  if (isHouseholdReadingFresh(lastReadingAt, nowMs)) return { kind: "live", label: "Live data" };
  return { kind: "stale", label: formatReadingAge(lastReadingAt, nowMs) };
}

const STREET_WORDS = new Set([
  "st", "street", "rd", "road", "ave", "avenue", "dr", "drive", "ct", "court",
  "cres", "crescent", "pde", "parade", "hwy", "highway", "ln", "lane", "pl", "place",
  "tce", "terrace", "way", "blvd", "boulevard", "cl", "close", "cct", "circuit",
  "esp", "esplanade",
]);

/** Null when the id looks like a street address (house number + street word). */
export function ownerHouseholdLabel(householdId: string | null | undefined): string | null {
  const id = (householdId ?? "").trim();
  if (!id) return null;
  const parts = id.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const hasHouseNumber = parts.some((p) => /^\d+[a-z]?$/.test(p));
  const hasStreetWord = parts.some((p) => STREET_WORDS.has(p));
  return hasHouseNumber && hasStreetWord ? null : id;
}
