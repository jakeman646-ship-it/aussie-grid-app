/**
 * Aussie Grid — Client-side QLD DNSP / tariff suggestion
 * File: src/lib/dnspLookup.ts
 * Version: v1.0.0
 * Updated: 19 Jul 2026
 *
 * Mirrors backend services/dnsp_lookup.py (static first pass).
 * Postcode is the primary signal — not AER boundary GIS.
 */

export type DnspCode = "ergon" | "energex";

export interface TariffSuggestion {
  ok: boolean;
  postcode: number | null;
  dnsp: DnspCode | null;
  networkTariffProfile: string | null;
  confidence: "high" | "medium" | "none";
  /** Short UI line, e.g. "High confidence - postcode 4740 -> Ergon / Ergon 12D" */
  summary: string;
  reason: string;
}

const ENERGEX_RANGES: ReadonlyArray<readonly [number, number]> = [
  [4000, 4209],
  [4210, 4299],
  [4300, 4349],
  [4500, 4519],
  [4550, 4575],
];

const EXPLICIT: Record<number, DnspCode> = {
  4000: "energex",
  4001: "energex",
  4101: "energex",
  4217: "energex",
  4551: "energex",
  4740: "ergon", // Mackay pilot
  4810: "ergon",
  4870: "ergon",
  4700: "ergon",
};

const DNSP_LABEL: Record<DnspCode, string> = {
  ergon: "Ergon",
  energex: "Energex",
};

const PROFILE_LABEL: Record<string, string> = {
  ergon_12d: "Ergon 12D",
  energex_ntc6900: "Energex NTC6900",
};

export function normalisePostcode(postcode: string | number | null | undefined): number | null {
  if (postcode === null || postcode === undefined) return null;
  const digits = String(postcode).replace(/\D/g, "");
  if (digits.length < 3) return null;
  const n = Number.parseInt(digits.slice(0, 4), 10);
  return Number.isFinite(n) ? n : null;
}

export function lookupDnsp(postcode: string | number | null | undefined): DnspCode | null {
  const pc = normalisePostcode(postcode);
  if (pc === null) return null;
  if (EXPLICIT[pc]) return EXPLICIT[pc];
  if (pc < 4000 || pc > 4999) return null;
  for (const [start, end] of ENERGEX_RANGES) {
    if (pc >= start && pc <= end) return "energex";
  }
  return "ergon";
}

export function defaultTariffProfile(dnsp: DnspCode | null): string | null {
  if (dnsp === "energex") return "energex_ntc6900";
  if (dnsp === "ergon") return "ergon_12d";
  return null;
}

/** Live preview helper for Connect Inverter / signup forms. */
export function suggestTariffFromPostcode(
  postcode: string | number | null | undefined,
  state?: string | null
): TariffSuggestion {
  const pc = normalisePostcode(postcode);
  const st = (state || "").trim().toUpperCase();

  if (pc === null) {
    return {
      ok: false,
      postcode: null,
      dnsp: null,
      networkTariffProfile: null,
      confidence: "none",
      summary: "Enter a QLD postcode to see the suggested network tariff",
      reason: "postcode required",
    };
  }

  if (st && st !== "QLD" && (pc < 4000 || pc > 4999)) {
    return {
      ok: false,
      postcode: pc,
      dnsp: null,
      networkTariffProfile: null,
      confidence: "none",
      summary: "Tariff preview is QLD-only for now — our team will set DNSP manually",
      reason: `state ${st} outside QLD scope`,
    };
  }

  if (pc < 4000 || pc > 4999) {
    return {
      ok: false,
      postcode: pc,
      dnsp: null,
      networkTariffProfile: null,
      confidence: "none",
      summary: "That postcode is outside Queensland — we'll confirm tariff during review",
      reason: "non-QLD postcode",
    };
  }

  const dnsp = lookupDnsp(pc);
  const profile = defaultTariffProfile(dnsp);
  if (!dnsp || !profile) {
    return {
      ok: false,
      postcode: pc,
      dnsp: null,
      networkTariffProfile: null,
      confidence: "none",
      summary: "Could not map that postcode — we'll confirm during review",
      reason: "no mapping",
    };
  }

  const confidence: "high" | "medium" = EXPLICIT[pc] ? "high" : "high";
  const dnspLabel = DNSP_LABEL[dnsp];
  const profileLabel = PROFILE_LABEL[profile] ?? profile;
  const reason =
    pc in EXPLICIT
      ? `explicit anchor for postcode ${pc}`
      : dnsp === "energex"
        ? `postcode ${pc} in Energex SEQ ranges`
        : `postcode ${pc} is regional QLD -> Ergon`;

  return {
    ok: true,
    postcode: pc,
    dnsp,
    networkTariffProfile: profile,
    confidence,
    summary: `High confidence - postcode ${pc} -> ${dnspLabel} / ${profileLabel}`,
    reason,
  };
}
