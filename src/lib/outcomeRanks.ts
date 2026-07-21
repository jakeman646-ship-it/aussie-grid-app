/**
 * Aussie Grid — Outcome ranks helpers
 * File: src/lib/outcomeRanks.ts
 * Version: v0.1.0
 * Updated: 21 Jul 2026 — P0 defaults + labels + validation (Mackay/Ergon-first).
 */
import {
  OUTCOME_KEYS,
  type OutcomeKey,
  type OutcomeRanks,
} from "@/types/outcomeRanks";

/** Mackay / Ergon-first pilot defaults (1 = most important). */
export const DEFAULT_OUTCOME_RANKS: OutcomeRanks = {
  bill_savings: 1,
  self_consumption: 2,
  battery_care: 3,
  network_gentle: 4,
  export_value: 5,
  comfort: 6,
};

/** Plain-English labels for Profile / Dashboard. */
export const OUTCOME_LABELS: Record<OutcomeKey, string> = {
  bill_savings: "Bill savings",
  self_consumption: "Self-consumption",
  comfort: "Comfort",
  export_value: "Export value",
  network_gentle: "Network-gentle",
  battery_care: "Battery care",
};

/** Keys ordered from rank 1 (first) to 6 (last). */
export function sortKeysByRank(ranks: OutcomeRanks): OutcomeKey[] {
  return [...OUTCOME_KEYS].sort((a, b) => ranks[a] - ranks[b]);
}

/** Build ranks map from an ordered list (index 0 ? rank 1). */
export function ranksFromOrderedKeys(ordered: OutcomeKey[]): OutcomeRanks {
  const next = { ...DEFAULT_OUTCOME_RANKS };
  ordered.forEach((key, index) => {
    next[key] = index + 1;
  });
  return next;
}

/**
 * Top n priorities as "Bill savings ? Self-consumption ? …".
 */
export function formatTopPriorities(ranks: OutcomeRanks, n = 3): string {
  return sortKeysByRank(ranks)
    .slice(0, Math.max(1, Math.min(n, OUTCOME_KEYS.length)))
    .map((key) => OUTCOME_LABELS[key])
    .join(" ? ");
}

/** True when all six keys present with unique ranks 1–6. */
export function validateRanks(ranks: unknown): ranks is OutcomeRanks {
  if (!ranks || typeof ranks !== "object") return false;
  const obj = ranks as Record<string, unknown>;
  const values: number[] = [];
  for (const key of OUTCOME_KEYS) {
    const v = obj[key];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 6) {
      return false;
    }
    values.push(v);
  }
  return new Set(values).size === 6;
}

/** Coerce DB/json into a valid map, else defaults. */
export function coerceRanks(raw: unknown): OutcomeRanks {
  if (validateRanks(raw)) return { ...raw };
  return { ...DEFAULT_OUTCOME_RANKS };
}
