/**
 * Pilot config + weekly readout types
 * File: src/types/pilotConfig.ts
 * Version: v0.1.2.19
 * Lines: 44
 */
/**
 * Global Mackay pilot phase toggle.
 * @see aussie-grid-backend/models/pilot_config.py — PilotPhase
 */
export type PilotPhase = "pre_pilot" | "active";

export interface SavingsOpportunity {
  category: string;
  potential_aud: number;
  description: string;
}

export interface DailyBreakdownEntry {
  date: string;
  savings_aud: number;
  baseline_cost: number;
  actual_cost: number;
}

export interface WeeklyReadout {
  household_id: string;
  week_start: string;
  week_end: string;
  total_savings_aud: number;
  avg_daily_savings_aud: number;
  projected_monthly_bill_reduction_aud: number;
  projected_annual_bill_reduction_aud: number;
  savings_opportunities: SavingsOpportunity[];
  daily_breakdown: DailyBreakdownEntry[];
  agent_summary?: string | null;
  compiled_at?: string;
  runner_version?: string;
}

export interface PilotConfig {
  config_key: string;
  pilot_phase: PilotPhase;
  updated_at?: string;
  updated_by?: string | null;
}

export function pilotPhaseLabel(phase: PilotPhase): string {
  return phase === "active" ? "Active pilot" : "Pre-pilot learning";
}
