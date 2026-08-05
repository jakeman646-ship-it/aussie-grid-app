/**
 * Aussie Grid — Record agent control preference
 * File: src/lib/api/activateAgentControl.ts
 * Version: v0.1.2.21
 * Updated: 6 Aug 2026 — preference write; no time/readings gate; impersonation blocked.
 */
import { supabase, queryTimeout } from "@/lib/supabase";

export interface ActivateAgentControlOptions {
  /** When true, refuse UPDATE (same guard as outcome ranks). */
  isImpersonating?: boolean;
}

/**
 * Record agent control preference (agent_control_mode = agent_control).
 * Does not enable automatic inverter actuation by itself.
 * Never updates pilot_households under impersonation.
 * No date or readings eligibility checks — owner may opt in anytime when connected.
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
    throw new Error("Missing household id — cannot save agent control preference.");
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
