import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalize, validEnvelope } from "../exchange-panel.mjs";

test("REZON exports retain native schema and identify known producer from that schema", () => {
  const session = { schema: "architectonica.seven-transmissions-session/1.1.0", id: "session-12345678", laboratory: "reson" };
  const [wrappedSession] = normalize(session);
  assert.equal(wrappedSession.source.product, "reson-transmissions");
  assert.equal(wrappedSession.source.repository, "reason-");
  assert.equal(wrappedSession.payload, session);
  assert.equal(wrappedSession.verified, false);

  const trace = { schema: "architectonica.axis-game-trace/1.0.0", id: "trace-12345678", evidence_status: "simulated", q: null };
  const [wrappedTrace] = normalize(trace);
  assert.equal(wrappedTrace.source.product, "reson-axis-game");
  assert.equal(wrappedTrace.payload.q, null);
  assert.equal(validEnvelope(wrappedTrace), true);
});

test("REZON accepts GDEYA exchange envelopes but never wraps the personal RTE memory bundle", () => {
  const gdeya = { schema: "architectonica.ecosystem-exchange/1.0.0", id: "exchange-12345678", created_at: new Date(0).toISOString(), source: { ecosystem: "architectonica", product: "gdeya-module", repository: "Game-GDEYA", record_schema: "architectonica.module-passport/1.2.0", record_id: "passport-12345678" }, payload: { schema: "architectonica.module-passport/1.2.0", id: "passport-12345678" }, evidence_class: "none", verified: false };
  assert.equal(normalize(gdeya)[0], gdeya);
  assert.throws(() => normalize({ format: "rte-resonance-bundle", version: 2, memory: [], glossary: [], settings: [] }));
});

test("all REZON app routes load the exchange panel and service worker caches its runtime", async () => {
  const root = new URL("../", import.meta.url);
  const [main, field, transmissions, axis, worker, schema, contract] = await Promise.all([
    "index.html", "field-check/index.html", "transmissions/index.html", "axis-game/index.html", "sw.js", "exchange.schema.json", "EXCHANGE.md",
  ].map((path) => readFile(new URL(path, root), "utf8")));
  for (const html of [main, field, transmissions, axis]) assert.match(html, /exchange-panel\.mjs/u);
  assert.match(worker, /exchange-panel\.mjs/u);
  assert.match(worker, /axis-game\/index\.html/u);
  assert.match(schema, /architectonica\.ecosystem-exchange\/1\.0\.0/u);
  assert.match(contract, /пакет личной памяти/u);
  assert.match(worker, /EXCHANGE\.md/u);
});
