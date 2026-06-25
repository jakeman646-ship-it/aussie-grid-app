/** Safe stub version — we read from package.json later once Vite JSON import is configured */
export const APP_VERSION = "0.8.2";
export const APP_VERSION_LABEL = "Pilot";

export function formatAppVersion(short = false): string {
  if (short || !APP_VERSION_LABEL) {
    return `v${APP_VERSION}`;
  }
  return `v${APP_VERSION} – ${APP_VERSION_LABEL}`;
}
