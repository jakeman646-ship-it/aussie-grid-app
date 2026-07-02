/**
 * Aussie Grid — Common
 * File: src/components/common/AppVersionBadge.tsx
 * Version: v0.1.2.7
 * Lines: 14
 */
import { formatAppVersion } from "@/lib/version";

export function AppVersionBadge() {
  return (
    <div className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs font-mono text-emerald-400 border border-emerald-500/30">
      {formatAppVersion(true)} • Pilot Build
    </div>
  );
}