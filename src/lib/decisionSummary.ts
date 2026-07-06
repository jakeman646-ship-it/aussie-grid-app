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

const HARMONY_LABELS: Record<string, string> = {
  normal: "Community running normally",
  preserve_battery: "Preserving batteries across the community",
  peak_support: "Helping the community cut peak grid imports",
  soak_surplus: "Charging with the community ahead of the evening peak",
  increase_export: "Community sharing surplus solar",
  reduce_export: "Easing exports across the community",
};

export function formatHarmonyDetail(recommendation: string | undefined): string {
  if (!recommendation) return "No coordination data";
  return HARMONY_LABELS[recommendation.toLowerCase().trim()] ?? recommendation;
}