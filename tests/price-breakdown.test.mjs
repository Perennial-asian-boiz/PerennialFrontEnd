// S3-01: the Company page's Price Breakdown (AC 1: close, day's change in dollars and percent,
// 52-week high and low; AC 2: source and trading-day date; AC 4: "Price unavailable", never an
// invented number). Rendered to static HTML with react-dom/server; fetch is replaced per test.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsxLoader } from "./render-tsx.mjs";

const OK = {
  api_version: "v1", symbol: "PLTR", status: "ok", source: "Finnhub", as_of: "2026-11-13",
  currency: "USD", close: 182.41, previous_close: 184.58, change: -2.17, change_percent: -1.175642,
  high_52w: 207.52, high_52w_date: "2026-02-18", low_52w: 63.4, low_52w_date: "2025-11-21", stale: false,
};
const UNAVAILABLE = {
  api_version: "v1", symbol: "CRSP", status: "unavailable", source: null, as_of: null, currency: null,
  close: null, previous_close: null, change: null, change_percent: null, high_52w: null,
  high_52w_date: null, low_52w: null, low_52w_date: null, stale: false,
};

let loader, api, view;
const originalFetch = globalThis.fetch;
beforeEach(async () => {
  loader = await tsxLoader();
  api = await loader.load("src/api/price.ts");
  view = await loader.load("src/components/PriceBreakdown.tsx");
});
afterEach(async () => { globalThis.fetch = originalFetch; await loader.cleanup(); });

const render = (state) => renderToStaticMarkup(createElement(view.PriceBreakdownView, { state }));
const ready = (price) => render({ kind: "ready", price });

test("AC 1: the latest close, the day's change in dollars and percent, and the 52-week range", () => {
  const html = ready(OK);
  assert.match(html, /Current price<\/span><strong>\$182\.41/);
  assert.match(html, /−\$2\.17 \(−1\.18%\)/);
  assert.match(html, /class="price-down"/);
  assert.match(html, /52-week low<strong>\$63\.40/);
  assert.match(html, /52-week high<strong>\$207\.52/);
  assert.match(html, /dateTime="2025-11-21"/);
});

test("the card uses the Figma wording, and fair value reads N/A until Perennial computes one", () => {
  for (const html of [ready(OK), ready(UNAVAILABLE), render({ kind: "error" })]) {
    assert.match(html, /Latest market price vs\. fair value range/);
    assert.match(html, /Fair value range<\/span><strong>N\/A</);
  }
});

test("a rise is marked up with a plus sign", () => {
  const html = ready({ ...OK, close: 190, change: 7.59, change_percent: 4.160956 });
  assert.match(html, /\+\$7\.59 \(\+4\.16%\)/);
  assert.match(html, /class="price-up"/);
});

test("AC 2: the source and the trading day of the close are shown", () => {
  const html = ready(OK);
  assert.match(html, /Source: Finnhub · Close of <time dateTime="2026-11-13">Nov 13, 2026<\/time> · USD/);
});

test("AC 4: no licensed price shows \"Price unavailable\" and no number at all", () => {
  for (const html of [ready(UNAVAILABLE), render({ kind: "error" })]) {
    assert.match(html, /Price unavailable/);
    assert.doesNotMatch(html, /\$|\d+\.\d|52-week low|Source:/);
  }
});

test("a missing change or range says so instead of guessing", () => {
  const html = ready({ ...OK, previous_close: null, change: null, change_percent: null,
    high_52w: null, high_52w_date: null, low_52w: null, low_52w_date: null });
  assert.match(html, /Day&#x27;s change<\/span><strong>Not available/);
  assert.match(html, /52-week range not available/);
  assert.match(html, /\$182\.41/);
});

test("an old close is still shown, labelled as older", () => {
  const html = ready({ ...OK, stale: true });
  assert.match(html, /Older price/);
  assert.match(html, /Newer prices haven&#x27;t arrived yet/);
  assert.match(html, /\$182\.41/);
});

test("the range marker sits where the close falls, kept inside the bar", () => {
  assert.match(ready(OK), /left:\s*82\.6/);  // (182.41 - 63.4) / (207.52 - 63.4)
  assert.match(ready({ ...OK, close: 300 }), /left:\s*100\.0%/);
});

test("the response check accepts both documented bodies and refuses a bare number", () => {
  assert.equal(api.isPriceResponse(OK), true);
  assert.equal(api.isPriceResponse(UNAVAILABLE), true);
  for (const bad of [null, [], { ...OK, source: null }, { ...OK, as_of: null }, { ...OK, close: 0 },
    { ...OK, close: "182.41" }, { ...OK, stale: "no" }, { ...OK, status: "partial" }, { ...OK, change: Infinity }]) {
    assert.equal(api.isPriceResponse(bad), false, JSON.stringify(bad));
  }
});

test("loadPrice requests the canonical symbol once and caches the answer", async () => {
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(String(url)); return Response.json(OK); };
  assert.deepEqual(await api.loadPrice(" pltr "), OK);
  await api.loadPrice("PLTR");
  assert.deepEqual(urls, ["http://test.invalid/v1/securities/PLTR/price"]);
});

test("loadPrice turns an error status or a malformed body into a PriceApiError", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: "unknown_security" } }), { status: 404 });
  await assert.rejects(api.loadPrice("ZZNONE"), (error) => error instanceof api.PriceApiError && error.status === 404);
  globalThis.fetch = async () => Response.json({ ...OK, close: "a lot" });
  await assert.rejects(api.loadPrice("ZZBAD"), api.PriceApiError);
});
