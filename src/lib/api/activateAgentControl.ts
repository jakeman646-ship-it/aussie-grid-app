/**
 * Aussie Grid — Activate agent control
 * File: src/lib/api/activateAgentControl.ts
 * Version: v0.1.2.20
 * Updated: 24 Jul 2026 — block writes while impersonating (security 4).
 */
import { supabase, queryTimeout } from "@/lib/supabase";

export interface ActivateAgentControlOptions {
  /** When true, refuse UPDATE (same guard as outcome ranks). */
  isImpersonating?: boolean;
}

/**
 * Switch a household from read-only to full agent control.
 * Never updates pilot_households under impersonation.
 */
export async function activateAgentControl(
  householdId: string,
  options: ActivateAgentControlOptions = {},
): Promise<void> {
  if (options.isImpersonating) {
    throw new Error("Agent control can't be changed while viewing another household.");
  }

  const id = (householdId || "").trim();
  if (!id) {
    throw new Error("Missing household id — cannot activate agent control.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("pilot_households")
    .update({
      agent_control_mode: "agent_control",
      agent_control_activated_at: now,
      updated_at: now,
    })
    .eq("household_id", id)
    .abortSignal(queryTimeout());

  if (error) throw error;
}
