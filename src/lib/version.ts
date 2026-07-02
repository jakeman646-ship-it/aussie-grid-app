/** Aussie Grid Neighbourhood Power pilot frontend version */
export const APP_VERSION = "0.1.2.7";
export const APP_VERSION_LABEL = "Pilot";

export function formatAppVersion(short = false): string {
  if (short || !APP_VERSION_LABEL) {
    return `v${APP_VERSION}`;
  }
  return `v${APP_VERSION} – ${APP_VERSION_LABEL}`;
}