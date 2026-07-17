/**
 * Aussie Grid — Sungrow Connection Status (STUB)
 * File: src/components/SungrowConnectionStatus.tsx
 * Version: v0.1.0-stub
 * Updated: 18 Jul 2026
 *
 * EXAMPLE / STUB OEM adapter — validates that the shared energy-system status
 * pattern works for a second brand alongside Sigenergy.
 *
 * This is NOT a live Sungrow integration. It does not call iSolarCloud,
 * does not write tokens, and never claims "connected".
 *
 * When implementing for real:
 *  1. Add useSungrowStatus (honest connected / data_not_ready / not_configured)
 *  2. Wire refresh / health from existing Sungrow paths (OAuth stays in FastAPI)
 *  3. Keep dry-run / control out of this card until Phase B consent
 *  4. Replace stub blurbs + meta with live plant_id / last ingest
 *
 * Pattern mirror: SigenergyConnectionStatus.tsx → EnergySystemStatusCard
 */
import type { EnergySystemStatusBaseProps } from "@/types/energySystemStatus";
import {
  EnergySystemStatusCard,
  ENERGY_SYSTEM_STATUS_STYLES,
  detectOemFromInverterMake,
  shouldHideOemCardOnOverview,
} from "@/components/energySystem";

const OEM_ID = "sungrow" as const;
const OEM_LABEL = "Sungrow";

export interface SungrowConnectionStatusProps extends EnergySystemStatusBaseProps {}

/**
 * Stub adapter for Sungrow.
 *
 * Overview behaviour:
 *  - Hidden on non-Sungrow households (avoids clutter next to Sigenergy)
 *  - On Sungrow households: shows a read-only “not yet implemented” card
 *    using the shared EnergySystemStatusCard shell
 */
export function SungrowConnectionStatus({
  householdId,
  variant = "full",
  inverterMake = null,
}: SungrowConnectionStatusProps) {
  const isOverview = variant === "overview";
  const detected = detectOemFromInverterMake(inverterMake);

  // Same hide rule as Sigenergy — other OEM configured elsewhere → skip.
  if (
    shouldHideOemCardOnOverview({
      variant,
      status: "not_configured",
      hasExternalId: false,
      inverterMake,
      oemId: OEM_ID,
    })
  ) {
    return null;
  }

  // Stub-only: on Dashboard overview, only mount UI for clear Sungrow homes.
  // Unknown / Sigenergy / Tesla households stay clean (Sigenergy adapter covers those).
  if (isOverview && detected !== "sungrow") {
    return null;
  }

  const presentation = ENERGY_SYSTEM_STATUS_STYLES.not_configured;

  return (
    <EnergySystemStatusCard
      oemId={OEM_ID}
      oemLabel={OEM_LABEL}
      title={`${OEM_LABEL} connection status (stub)`}
      presentation={presentation}
      blurb="Stub adapter — Sungrow status UI is not implemented yet. This card only proves the shared EnergySystemStatusCard pattern works for a second OEM. Monitoring / read-only; no OAuth or ingest from here."
      usingPlaceholder
      busy={false}
      metaItems={[
        { label: "Household", value: householdId || "—", mono: true },
        { label: "Plant ID", value: "(not wired — stub)" },
        { label: "Last ingest", value: "—" },
        { label: "Implementation", value: "Not yet implemented" },
      ]}
      alerts={
        <div className="mt-3 rounded-md border border-slate-600/50 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
          <span className="font-medium text-amber-200/90">Example OEM stub.</span> Replace with a
          real <code className="text-slate-200">useSungrowStatus</code> hook and plant metadata when
          ready. Do not mark Connected until a usable data pull exists.
        </div>
      }
      actionHint={
        <p className="mt-2 text-[11px] text-slate-500">
          No actions in this stub. Live Sungrow OAuth remains on FastAPI (
          <code className="text-slate-400">/auth/sungrow/*</code>) — not this card.
        </p>
      }
      footer={
        <p className="text-xs text-slate-500">
          Read-only stub · Pattern:{" "}
          <code className="text-slate-400">components/energySystem/</code> · Mirror{" "}
          <code className="text-slate-400">SigenergyConnectionStatus.tsx</code> for a full adapter.
        </p>
      }
    />
  );
}

export default SungrowConnectionStatus;
