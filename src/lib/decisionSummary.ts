import type { AgentDecision } from "@/types/agentDecision";

export function buildDecisionSummary(decision: AgentDecision): string {
  if (!decision) return "No decision data available yet.";
  return decision.reason || "Agent is managing your home energy normally.";
}

export function buildFriendlyReason(reason: string, _mode: string): string {
  if (reason && reason.length > 5) return reason;
  return "Operating in the best mode for current conditions.";
}

export function buildModeContextLine(
  _decision: AgentDecision | undefined,
  _reason: string
): string {
  return "Based on your battery, solar forecast, and grid conditions right now.";
}

export function formatHarmonyDetail(recommendation: string | undefined): string {
  if (!recommendation) return "No coordination data";
  return recommendation;
}