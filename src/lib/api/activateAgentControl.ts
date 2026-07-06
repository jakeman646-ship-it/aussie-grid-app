import { supabase, queryTimeout } from "@/lib/supabase";

/**
 * Switch a household from read-only to full agent control.
 */
export async function activateAgentControl(householdId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("pilot_households")
    .update({
      agent_control_mode: "agent_control",
      agent_control_activated_at: now,
      updated_at: now,
    })
    .eq("household_id", householdId)
    .abortSignal(queryTimeout());

  if (error) throw error;
}
