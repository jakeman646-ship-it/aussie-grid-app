/**
 * Aussie Grid — Version
 * File: src/lib/version.ts
 * Version: v0.1.3.0
 * Lines: 16
 * Updated: 19 Jul 2026 — Connect Inverter location fields + tariff preview.
 */
export const APP_VERSION = "0.1.3.0";
export const APP_VERSION_LABEL = "Pilot";

export function formatAppVersion(short = false): string {
  if (short || !APP_VERSION_LABEL) {
    return `v${APP_VERSION}`;
  }
  return `v${APP_VERSION} – ${APP_VERSION_LABEL}`;
}
