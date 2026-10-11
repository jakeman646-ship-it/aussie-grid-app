import assert from "node:assert/strict";
import { test } from "node:test";

import { GRID_NOT_ON_FEED, formatGridFlow } from "../src/lib/modeLabels.ts";
import {
  ESTIMATED_DOLLAR_SENTENCE,
  buildSavingsHint,
  liveBadgeState,
  ownerHouseholdLabel,
} from "../src/lib/ownerHonesty.ts";
import { formatSocPct } from "../src/components/energySystem/statusPresentation.ts";

const NOW = Date.parse("2026-10-11T00:30:00Z");

test("missing grid is not Balanced", () => {
  assert.equal(formatGridFlow(null), GRID_NOT_ON_FEED);
  assert.equal(formatGridFlow(undefined), GRID_NOT_ON_FEED);
  assert.equal(formatGridFlow(Number.NaN), GRID_NOT_ON_FEED);
  assert.notEqual(formatGridFlow(null), "Balanced");
  assert.equal(formatGridFlow(0), "Balanced");
  assert.equal(formatGridFlow(1.24), "Importing 1.2 kW");
  assert.equal(formatGridFlow(-3), "Exporting 3.0 kW");
});

test("missing battery level shows a dash, not 0%", () => {
  assert.equal(formatSocPct(null), "—");
  assert.equal(formatSocPct(66.3), "66%");
});

test("$ hint matches weekly report and omits battery and FIT when stored $ is 0", () => {
  for (const stored of [
    { batteryDischargeAud: 0, exportAud: 0 },
    { batteryDischargeAud: null, exportAud: null },
    {},
  ]) {
    const hint = buildSavingsHint(stored);
    assert.equal(hint, ESTIMATED_DOLLAR_SENTENCE);
    assert.doesNotMatch(hint, /battery|FIT|feed-in|6c/i);
  }
  assert.equal(
    ESTIMATED_DOLLAR_SENTENCE,
    "Solar used in the house × Ergon 12D time-of-use. Sample-based from ~30-minute readings — not a meter total.",
  );
});

test("$ hint names battery or feed-in only when that stored $ is > 0", () => {
  const battery = buildSavingsHint({ batteryDischargeAud: 0.42, exportAud: 0 });
  assert.match(battery, /battery discharge/);
  assert.doesNotMatch(battery, /feed-in/);
  const exported = buildSavingsHint({ batteryDischargeAud: 0, exportAud: 1.1 });
  assert.match(exported, /feed-in tariff/);
  assert.doesNotMatch(exported, /battery/);
});

test("Live data badge only inside 2 hours", () => {
  assert.deepEqual(liveBadgeState("2026-10-11T00:00:44Z", NOW), { kind: "live", label: "Live data" });
  assert.deepEqual(liveBadgeState("2026-10-10T21:30:00Z", NOW), {
    kind: "stale",
    label: "Last reading 3 h ago",
  });
  assert.deepEqual(liveBadgeState("2026-10-08T00:30:00Z", NOW), {
    kind: "stale",
    label: "Last reading 3 d ago",
  });
  assert.deepEqual(liveBadgeState(null, NOW), { kind: "none" });
});

test("owner header hides street-like household ids", () => {
  assert.equal(ownerHouseholdLabel("11-hinton-st-jack-mckenzie-"), null);
  assert.equal(ownerHouseholdLabel("valmadres"), "valmadres");
  assert.equal(ownerHouseholdLabel("mackay-pilot-01"), "mackay-pilot-01");
});
