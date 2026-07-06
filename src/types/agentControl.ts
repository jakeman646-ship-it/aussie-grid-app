/**
 * Per-household agent control mode.
 * @see aussie-grid-backend/models/pilot_household.py — AgentControlMode
 */
export type AgentControlMode = "read_only" | "agent_control";

export function agentControlLabel(mode: AgentControlMode): string {
  return mode === "agent_control" ? "Agent control active" : "Read-only mode";
}

export function isAgentControlActive(mode: AgentControlMode | undefined | null): boolean {
  return mode === "agent_control";
}
