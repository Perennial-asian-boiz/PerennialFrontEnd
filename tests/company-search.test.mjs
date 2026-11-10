import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { tsxLoader } from "./render-tsx.mjs";

const originalFetch = globalThis.fetch;
let loader, api, calls, payload;

beforeEach(async () => {
  loader = await tsxLoader();
  api = await loader.load("src/api/companySearch.ts");
  calls = [];
  payload = { api_version: "v1", query: "N", results: [
    { symbol: "NVDA", name: "NVIDIA Corporation", sector: "Technology" },
    { symbol: "NHEALTH", name: "New Health", sector: "Healthcare" },
    { symbol: "NONAME", name: null, sector: null },
  ], limit: 50, offset: 0, has_more: false };
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json(payload);
  };
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await loader.cleanup();
});

test("single-letter search uses the global API without sectors or publication filters", async () => {
  const page = await api.searchCompanies(" N ");
  assert.deepEqual(page.results.map((row) => row.symbol), ["NVDA", "NHEALTH", "NONAME"]);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/v1/securities");
  assert.deepEqual([...url.searchParams], [["q", "N"], ["limit", "50"], ["offset", "0"]]);
});

test("blank query never requests the database", async () => {
  assert.deepEqual((await api.searchCompanies("  ")).results, []);
  assert.equal(calls.length, 0);
});

test("query characters are URL encoded and the next page carries its offset", async () => {
  payload.query = "A&B /%";
  payload.offset = 50;
  await api.searchCompanies("A&B /%", 50);
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get("q"), "A&B /%");
  assert.equal(url.searchParams.get("offset"), "50");
});

test("cancellation is passed through so stale searches can be discarded", async () => {
  const controller = new AbortController();
  globalThis.fetch = async (_url, { signal }) => {
    assert.equal(signal, controller.signal);
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
  };
  const pending = api.searchCompanies("N", 0, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("API failures stay distinguishable from an empty result and allow retry", async () => {
  globalThis.fetch = async () => Response.json({}, { status: 503 });
  await assert.rejects(api.searchCompanies("N"), /503/);
  globalThis.fetch = async () => Response.json(payload);
  assert.equal((await api.searchCompanies("N")).results.length, 3);
});

test("malformed or mismatched pages cannot silently show wrong-company results", async () => {
  const valid = structuredClone(payload);
  for (const change of [
    { query: "OTHER" }, { offset: 50 }, { limit: 100 }, { has_more: "yes" },
    { results: [{ symbol: "bad<script>", name: "Bad", sector: null }] },
    { results: [valid.results[0], valid.results[0]] },
    { has_more: true },
  ]) {
    payload = { ...valid, ...change };
    await assert.rejects(api.searchCompanies("N"), /invalid response/);
  }
});
