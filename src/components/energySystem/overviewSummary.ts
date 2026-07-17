/**
 * Aussie Grid — Energy systems overview summary (shared)
 * File: src/components/energySystem/overviewSummary.ts
 * Version: v0.2.0
 * Updated: 18 Jul 2026 — mixed-status flag for glance UI
 *
 * Read-only counts for Dashboard glance + EnergySystemsSection header.
 * Mirrors OEM overview visibility without changing adapter behaviour.
 */
import type { EnergySystemConnectionStatus } from "@/types/energySystemStatus";
import {
  detectOemFromInverterMake,
  shouldHideOemCardOnOverview,
} from "./statusPresentation";

export type EnergySystemsOverviewSummary = {
  connected: number;
  notReady: number;
  notConfigured: number;
  checking: boolean;
  visible: number;
  /** Systems with a link / data path (connected + data_not_ready). */
  configured: number;
  /** Worst honest status across visible systems. */
  overall: EnergySystemConnectionStatus;
  /** notReady + notConfigured among visible systems. */
  needAttention: number;
  /**
   * True when more than one status bucket has systems
   * (e.g. some Connected + some Data Not Ready).
   */
  mixed: boolean;
};

export function buildEnergySystemsOverviewSummary(opts: {
  inverterMake: string | null | undefined;
  sigenergyStatus: EnergySystemConnectionStatus;
  sigenergySystemId: string | null;
  sigenergyLoading: boolean;
}): EnergySystemsOverviewSummary {
  const summary: EnergySystemsOverviewSummary = {
    connected: 0,
    notReady: 0,
    notConfigured: 0,
    checking: false,
    visible: 0,
    configured: 0,
    overall: "not_configured",
    needAttention: 0,
    mixed: false,
  };

  const hasSigenergyId = Boolean(opts.sigenergySystemId?.trim());
  const hideSigenergy = shouldHideOemCardOnOverview({
    variant: "overview",
    status: opts.sigenergyStatus,
    hasExternalId: hasSigenergyId,
    inverterMake: opts.inverterMake,
    oemId: "sigenergy",
  });

  if (!hideSigenergy) {
    summary.visible += 1;
    if (
      opts.sigenergyLoading &&
      opts.sigenergyStatus === "not_configured" &&
      !hasSigenergyId
    ) {
      summary.checking = true;
      summary.notConfigured += 1;
    } else if (opts.sigenergyStatus === "connected") {
      summary.connected += 1;
    } else if (opts.sigenergyStatus === "data_not_ready") {
      summary.notReady += 1;
    } else {
      summary.notConfigured += 1;
    }
  }

  const detected = detectOemFromInverterMake(opts.inverterMake);
  const hideSungrow = shouldHideOemCardOnOverview({
    variant: "overview",
    status: "not_configured",
    hasExternalId: false,
    inverterMake: opts.inverterMake,
    oemId: "sungrow",
  });
  if (!hideSungrow && detected === "sungrow") {
    summary.visible += 1;
    summary.notConfigured += 1;
  }

  summary.configured = summary.connected + summary.notReady;
  summary.needAttention = summary.notReady + summary.notConfigured;

  const activeBuckets =
    (summary.connected > 0 ? 1 : 0) +
    (summary.notReady > 0 ? 1 : 0) +
    (summary.notConfigured > 0 ? 1 : 0);
  summary.mixed = !summary.checking && summary.visible > 1 && activeBuckets > 1;

  if (summary.notConfigured > 0 || summary.visible === 0) {
    summary.overall = "not_configured";
  } else if (summary.notReady > 0) {
    summary.overall = "data_not_ready";
  } else {
    summary.overall = "connected";
  }

  return summary;
}
