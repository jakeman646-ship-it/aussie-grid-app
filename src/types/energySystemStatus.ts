/**
 * Aussie Grid — Energy system status (shared types)
 * File: src/types/energySystemStatus.ts
 * Version: v0.1.0
 * Updated: 18 Jul 2026
 *
 * Common vocabulary for OEM status cards (Sigenergy today; Sungrow / Tesla later).
 * Keep connection language honest: never invent "connected" without a usable data pull.
 */

/** Supported / planned OEM adapters for household energy system status cards. */
export type EnergySystemOemId =
  | "sigenergy"
  | "sungrow"
  | "tesla"
  | "other";

/**
 * Honest connection states shared across OEMs.
 * Map OEM-specific worker phases onto these for UI badges.
 */
export type EnergySystemConnectionStatus =
  | "connected"
  | "data_not_ready"
  | "not_configured";

/**
 * Where the card is rendered.
 * - `overview` — main Dashboard: compact / hide when irrelevant
 * - `full` — dedicated detail / expanded controls
 */
export type EnergySystemStatusVariant = "full" | "overview";

/** Visual presentation for a connection status badge / card ring. */
export interface EnergySystemStatusPresentation {
  label: string;
  badgeClass: string;
  dotClass: string;
  ringClass: string;
}

/** One meta cell in the status grid (last ingest, external id, etc.). */
export interface EnergySystemMetaItem {
  label: string;
  value: string;
  mono?: boolean;
}

/**
 * Read-only props every OEM status adapter should be able to supply.
 * OEM-specific dry-run / OAuth actions stay in the adapter component.
 */
export interface EnergySystemStatusBaseProps {
  householdId: string;
  variant?: EnergySystemStatusVariant;
  /** Household inverter_make from parent — used for overview hide/show. */
  inverterMake?: string | null;
}
