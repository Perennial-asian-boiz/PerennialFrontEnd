import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsxLoader } from "./render-tsx.mjs";

let loader, floats, filings, Metric;
const originalFetch = globalThis.fetch;
beforeEach(async () => {
  loader = await tsxLoader();
  floats = await loader.load("src/lib/publicFloat.ts");
  filings = await loader.load("src/api/secFilings.ts");
  Metric = (await loader.load("src/components/PublicFloatMetric.tsx")).default;
});
afterEach(async () => { globalThis.fetch = originalFetch; await loader.cleanup(); });

test("SEC public float uses its published USD amount and measurement date, with caution flags", () => {
  assert.deepEqual(floats.readPublicFloat({ public_float: 2_320_000_000, public_float_as_of: "2025-03-31", size_flags: ["size_estimate_stale"] }),
    { value: 2_320_000_000, asOf: "2025-03-31", caution: true });
});

test("missing or invalid float/date never falls back to a market cap or invented zero", () => {
  for (const entry of [null, {}, { market_cap: 99 }, { public_float: 0, public_float_as_of: "2025-03-31" },
    { public_float: "500", public_float_as_of: "2025-03-31" }, { public_float: Infinity, public_float_as_of: "2025-03-31" },
    { public_float: 500, public_float_as_of: "2025-02-30" }, { public_float: 500, public_float_as_of: null }]) {
    assert.equal(floats.readPublicFloat(entry), null);
  }
});

test("the finance row shows public float, its real as-of date, USD and the stale caution", () => {
  const html = renderToStaticMarkup(createElement(Metric, {
    value: { value: 2_320_000_000, asOf: "2025-03-31", caution: true },
  }));
  assert.match(html, /Public float/); assert.match(html, /\$2\.32B/);
  assert.match(html, /dateTime="2025-03-31"/); assert.match(html, /Mar 31, 2025/);
  assert.match(html, /USD/); assert.match(html, /Older measurement/);
  assert.doesNotMatch(html, /href=|Browse SEC filings|Market [Cc]ap/);
});

test("an absent public float stays unavailable even when a company has SEC filings", () => {
  const html = renderToStaticMarkup(createElement(Metric, { value: null }));
  assert.match(html, /Not available/); assert.doesNotMatch(html, /href=|As of|\$0/);
});

test("source URLs use numeric SEC CIKs, support share-class aliases and share one index request", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ tickers: { NVDA: 1045810, "BRK-B": 1067983 } }); };
  const urls = await Promise.all([filings.loadSecFilingsUrl(" nvda "), filings.loadSecFilingsUrl("BRK.B")]);
  assert.equal(urls[0], "https://www.sec.gov/edgar/browse/?CIK=1045810&owner=exclude");
  assert.equal(urls[1], "https://www.sec.gov/edgar/browse/?CIK=1067983&owner=exclude");
  assert.equal(calls, 1); assert.equal(await filings.loadSecFilingsUrl("UNKNOWN"), null);
});

test("malformed CIKs cannot create guessed or injected source links", async () => {
  globalThis.fetch = async () => Response.json({ tickers: { BAD: "javascript:alert(1)", ZERO: 0, HUGE: 1e20 } });
  for (const symbol of ["BAD", "ZERO", "HUGE"]) assert.equal(await filings.loadSecFilingsUrl(symbol), null);
});

test("a failed SEC index request can be retried", async () => {
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  await assert.rejects(filings.loadSecFilingsUrl("NVDA"));
  globalThis.fetch = async () => Response.json({ tickers: { NVDA: 1045810 } });
  assert.match(await filings.loadSecFilingsUrl("NVDA"), /CIK=1045810/);
});
