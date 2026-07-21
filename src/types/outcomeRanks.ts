/**
 * Aussie Grid — User-ranked outcome types
 * File: src/types/outcomeRanks.ts
 * Version: v0.1.0
 * Updated: 21 Jul 2026 — P0 suggest-only outcome ranks.
 */

export const OUTCOME_KEYS = [
  "bill_savings",
  "self_consumption",
  "comfort",
  "export_value",
  "network_gentle",
  "battery_care",
] as const;

export type OutcomeKey = (typeof OUTCOME_KEYS)[number];

/** Map of outcome key ? rank 1 (most important) through 6 (least). */
export type OutcomeRanks = Record<OutcomeKey, number>;

export type OutcomeRankSource = "default" | "user" | "ops_seed";

export interface HouseholdOutcomeRanksRow {
  id: string;
  household_id: string;
  effective_from: string;
  effective_to: string | null;
  ranks: OutcomeRanks;
  source: OutcomeRankSource;
  updated_by: string | null;
  created_at: string;
}
