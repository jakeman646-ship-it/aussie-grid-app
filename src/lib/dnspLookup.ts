/**
 * Aussie Grid — Client-side DNSP / tariff suggestion
 * File: src/lib/dnspLookup.ts
 * Version: v1.1.0
 * Updated: 28 Aug 2026 — NSW volunteer DNSP (unpriced); QLD $ unchanged
 *
 * Mirrors backend services/dnsp_lookup.py (static first pass).
 * Postcode is the primary signal — not AER boundary GIS.
 * NSW may join for monitoring. Dollar estimates stay QLD (Ergon/Energex).
 */

export type DnspCode = "ergon" | "energex" | "ausgrid" | "endeavour" | "essential";

export interface TariffSuggestion {
  ok: boolean;
  postcode: number | null;
  dnsp: DnspCode | null;
  networkTariffProfile: string | null;
  confidence: "high" | "medium" | "none";
  /** Short UI line */
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

const AUSGRID_RANGES: ReadonlyArray<readonly [number, number]> = [
  [2000, 2144],
  [2190, 2234],
  [2250, 2263],
  [2280, 2310],
];

const ENDEAVOUR_RANGES: ReadonlyArray<readonly [number, number]> = [
  [2145, 2179],
  [2500, 2530],
  [2555, 2579],
  [2745, 2777],
];

const ESSENTIAL_RANGES: ReadonlyArray<readonly [number, number]> = [
  [2340, 2430],
  [2440, 2490],
  [2580, 2739],
  [2790, 2880],
];

const EXPLICIT: Record<number, DnspCode> = {
  4000: "energex",
  4001: "energex",
  4101: "energex",
  4217: "energex",
  4551: "energex",
  4740: "ergon",
  4810: "ergon",
  4870: "ergon",
  4700: "ergon",
  2000: "ausgrid",
  2001: "ausgrid",
  2060: "ausgrid",
  2300: "ausgrid",
  2250: "ausgrid",
  2150: "endeavour",
  2500: "endeavour",
  2170: "endeavour",
  2750: "endeavour",
  2640: "essential",
  2650: "essential",
  2830: "essential",
  2340: "essential",
  2450: "essential",
};

const DNSP_LABEL: Record<DnspCode, string> = {
  ergon: "Ergon",
  energex: "Energex",
  ausgrid: "Ausgrid",
  endeavour: "Endeavour Energy",
  essential: "Essential Energy",
};

const PROFILE_LABEL: Record<string, string> = {
  ergon_12d: "Ergon 12D",
  energex_ntc6900: "Energex NTC6900",
};

const NSW_DNSPS = new Set<DnspCode>(["ausgrid", "endeavour", "essential"]);
const PRICED_PROFILES = new Set(["ergon_12d", "energex_ntc6900"]);

function pcInRanges(pc: number, ranges: ReadonlyArray<readonly [number, number]>): boolean {
  return ranges.some(([start, end]) => pc >= start && pc <= end);
}

export function normalisePostcode(postcode: string | number | null | undefined): number | null {
  if (postcode === null || postcode === undefined) return null;
  const digits = String(postcode).replace(/\D/g, "");
  if (digits.length < 3) return null;
  const n = Number.parseInt(digits.slice(0, 4), 10);
  return Number.isFinite(n) ? n : null;
}

function lookupNswDnsp(pc: number): DnspCode | null {
  const explicit = EXPLICIT[pc];
  if (explicit && NSW_DNSPS.has(explicit)) return explicit;
  if (pcInRanges(pc, ENDEAVOUR_RANGES)) return "endeavour";
  if (pcInRanges(pc, AUSGRID_RANGES)) return "ausgrid";
  if (pcInRanges(pc, ESSENTIAL_RANGES)) return "essential";
  return null;
}

export function lookupDnsp(postcode: string | number | null | undefined): DnspCode | null {
  const pc = normalisePostcode(postcode);
  if (pc === null) return null;
  if (EXPLICIT[pc]) return EXPLICIT[pc];
  if (pc >= 2000 && pc <= 2999) return lookupNswDnsp(pc);
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

export function isHouseholdPricedForDollars(opts: {
  state?: string | null;
  dnsp?: string | null;
  networkTariffProfile?: string | null;
}): boolean {
  const st = (opts.state || "").trim().toUpperCase();
  if (st === "NSW" || st === "NEW SOUTH WALES") return false;
  const d = (opts.dnsp || "").trim().toLowerCase();
  if (NSW_DNSPS.has(d as DnspCode)) return false;
  const pid = (opts.networkTariffProfile || "").trim().toLowerCase();
  if (pid && !PRICED_PROFILES.has(pid)) return false;
  return true;
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
      summary:
        "Enter a QLD or NSW postcode. Volunteer homes can connect for monitoring.",
      reason: "postcode required",
    };
  }

  const isQldPc = pc >= 4000 && pc <= 4999;
  const isNswPc = pc >= 2000 && pc <= 2999;
  const isNswState = st === "NSW" || st === "NEW SOUTH WALES";

  if (isNswPc || (isNswState && !isQldPc)) {
    const dnsp = isNswPc ? lookupDnsp(pc) : null;
    const nswDnsp = dnsp && NSW_DNSPS.has(dnsp) ? dnsp : isNswPc ? lookupNswDnsp(pc) : null;
    if (!nswDnsp) {
      return {
        ok: false,
        postcode: pc,
        dnsp: null,
        networkTariffProfile: null,
        confidence: "none",
        summary:
          "You can still connect for monitoring. Tell us the network name from your bill (Ausgrid, Endeavour, or Essential). Bill impact is not priced yet.",
        reason: "nsw fringe — ask bill network",
      };
    }
    const label = DNSP_LABEL[nswDnsp];
    return {
      ok: true,
      postcode: pc,
      dnsp: nswDnsp,
      networkTariffProfile: null,
      confidence: EXPLICIT[pc] === nswDnsp ? "high" : "medium",
      summary: `NSW — ${label} suggested. Bill impact not priced yet — monitoring only.`,
      reason: `postcode ${pc} -> ${nswDnsp}; tariff not priced`,
    };
  }

  if (st && st !== "QLD" && st !== "NSW" && !isQldPc) {
    return {
      ok: false,
      postcode: pc,
      dnsp: null,
      networkTariffProfile: null,
      confidence: "none",
      summary:
        "Volunteer homes outside QLD can connect for monitoring. Dollar estimates stay QLD (Ergon/Energex) until we have your bill tariff.",
      reason: `state ${st} outside QLD/NSW mapping`,
    };
  }

  if (!isQldPc) {
    return {
      ok: false,
      postcode: pc,
      dnsp: null,
      networkTariffProfile: null,
      confidence: "none",
      summary:
        "Volunteer homes can connect for monitoring. Dollar estimates stay QLD until we have your bill tariff.",
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
    confidence: "high",
    summary: `High confidence - postcode ${pc} -> ${dnspLabel} / ${profileLabel}`,
    reason,
  };
}
