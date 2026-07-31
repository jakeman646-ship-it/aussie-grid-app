/**
 * Aussie Grid — energy system status (shared module)
 * File: src/components/energySystem/index.ts
 *
 * Re-exports for OEM adapters + Dashboard Energy Systems section.
 * Future Sungrow/Tesla cards should import from here.
 */

export {
  EnergySystemStatusCard,
  EnergySystemStatusChecking,
  EnergySystemStatusCompactNotConfigured,
} from "./EnergySystemStatusCard";
export type { EnergySystemStatusCardProps } from "./EnergySystemStatusCard";

export {
  EnergySystemMetaCell,
  EnergySystemMetricCard,
  EnergySystemFieldRow,
} from "./EnergySystemStatusPrimitives";

export {
  ENERGY_SYSTEM_STATUS_STYLES,
  READING_FRESH_MS,
  detectOemFromInverterMake,
  shouldHideOemCardOnOverview,
  isHouseholdReadingFresh,
  energySystemStatusLabel,
  formatEnergyTimestamp,
  formatKwh,
  formatSocPct,
} from "./statusPresentation";

export { LastIngestHeaderGlance, LastIngestSummary } from "./LastIngestSummary";
export { EnergySystemsEmptyState } from "./EnergySystemsEmptyState";

export { EnergySystemsSection } from "./EnergySystemsSection";
export type { EnergySystemsSectionProps } from "./EnergySystemsSection";

export { ConnectionHealthSummary } from "./ConnectionHealthSummary";
export type { ConnectionHealthSummaryProps } from "./ConnectionHealthSummary";

export { EnergySystemsOverviewSummary } from "./EnergySystemsOverviewSummary";
export type { EnergySystemsOverviewSummaryProps } from "./EnergySystemsOverviewSummary";

export { buildEnergySystemsOverviewSummary } from "./overviewSummary";
export type { EnergySystemsOverviewSummary as EnergySystemsOverviewSummaryData } from "./overviewSummary";
