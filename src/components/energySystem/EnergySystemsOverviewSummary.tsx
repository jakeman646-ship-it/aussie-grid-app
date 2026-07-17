/**
 * Aussie Grid — Energy Systems Overview (glance strip)
 * File: src/components/energySystem/EnergySystemsOverviewSummary.tsx
 * Version: v0.3.0
 * Updated: 18 Jul 2026 — delegates to ConnectionHealthSummary
 *
 * Kept as a thin alias so older imports keep working.
 * Prefer ConnectionHealthSummary for new Dashboard wiring.
 */
export {
  ConnectionHealthSummary as EnergySystemsOverviewSummary,
  type ConnectionHealthSummaryProps as EnergySystemsOverviewSummaryProps,
} from "./ConnectionHealthSummary";

export { default } from "./ConnectionHealthSummary";
