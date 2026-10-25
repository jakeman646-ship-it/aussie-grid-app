import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { omitRecoverableSecrets } from "../src/lib/api/connectionSecrets.ts";

test("anon connection payload drops account_password", () => {
  const out = omitRecoverableSecrets({
    site_id: "2252267712345678",
    account_email: "owner@example.com",
    account_password: "not-stored",
    inverter_brand: "Tesla",
    notes: "13.5 kWh",
  });

  assert.equal("account_password" in out, false);
  assert.equal(out.site_id, "2252267712345678");
  assert.equal(out.account_email, "owner@example.com");
  assert.equal(out.inverter_brand, "Tesla");
  assert.equal(out.notes, "13.5 kWh");
});

test("shipped client does not collect or insert a Tesla password", () => {
  const submit = readFileSync(
    new URL("../src/lib/api/submitConnectionRequest.ts", import.meta.url),
    "utf8"
  );
  const form = readFileSync(
    new URL("../src/components/ConnectInverter.tsx", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(submit, /accountPassword/);
  assert.doesNotMatch(submit, /["']account_password["']/);
  assert.doesNotMatch(submit, /payload\.account_password/);
  assert.match(submit, /omitRecoverableSecrets/);
  assert.doesNotMatch(form, /accountPassword/);
  assert.doesNotMatch(form, /account_password/);
  assert.doesNotMatch(form, /Tesla account password/);
  assert.doesNotMatch(form, /type="password"/);
});
