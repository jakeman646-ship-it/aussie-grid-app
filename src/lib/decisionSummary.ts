/**
 * Aussie Grid — Decision summary copy helpers
 * File: src/lib/decisionSummary.ts
 * Version: v0.1.1
 * Updated: 21 Jul 2026 — optional priorities line (P0 suggest-only).
 */
import type { AgentDecision } from "@/types/agentDecision";

export function buildDecisionSummary(
  decision: AgentDecision,
  options?: { topPrioritiesLabel?: string | null },
): string {
  if (!decision) return "No decision data available yet.";
  const base = decision.reason || "Agent is managing your home energy normally.";
  const top = options?.topPrioritiesLabel?.trim();
  if (!top) return base;
  return `Based on your priorities (${top}), today’s suggestion is shaped by current conditions. ${base}`;
}

export function buildFriendlyReason(reason: string, _mode: string): string {
  if (reason && reason.length > 5) return reason;
  return "Operating in the best mode for current conditions.";
}

export function buildModeContextLine(
  _decision: AgentDecision | undefined,
  _reason: string,
  options?: { topPrioritiesLabel?: string | null; dataHealthy?: boolean },
): string {
  const top = options?.topPrioritiesLabel?.trim();
  if (options?.dataHealthy && top) {
    return `Based on your priorities (${top}), plus battery, solar forecast, and grid conditions right now.`;
  }
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