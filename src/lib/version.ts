/**
 * Aussie Grid — Version
 * File: src/lib/version.ts
 * Version: v0.1.2.20
 * Lines: 16
 * Updated: 7 Jul 2026 — fix Sungrow approve transfer (site_id, inverter_serial).
 */
export const APP_VERSION = "0.1.2.20";
export const APP_VERSION_LABEL = "Pilot";

export function formatAppVersion(short = false): string {
  if (short || !APP_VERSION_LABEL) {
    return `v${APP_VERSION}`;
  }
  return `v${APP_VERSION} – ${APP_VERSION_LABEL}`;
}
