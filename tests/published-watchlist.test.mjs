import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { tsxLoader } from "./render-tsx.mjs";

const originalFetch = globalThis.fetch;
let loader, api, sections, publication, display, requests, respond;

function entry(ticker, rank, ark = null, insider = null) {
  return { ticker, rank, signals: { ark, insider, congress: null, short_interest: null } };
}

function company(ticker, sector = "Technology") {
  return {
    name: `${ticker} company`, ticker, sector, price: null, change_percent: null,
    confidence_score: null, sentiment: "Neutral", reason: null,
  };
}

beforeEach(async () => {
  loader = await tsxLoader();
  api = await loader.load("src/api/publishedWatchlist.ts");
  ({ getDashboardSections: sections } = await loader.load("src/dashboardData.ts"));
  publication = {
    api_version: "v1", publication: { id: 6 },
    watchlist: { affordable_growing: [entry("ONE", 1)], popular_stable: [] },
  };
  display = { schema_version: "1.0", generated_at: "2026-11-06T21:08:17Z", affordable_growing: [company("ONE")], popular_stable: [] };
  requests = [];
  respond = (url) => {
    if (url.endsWith("/v1/watchlist")) return Response.json(publication);
    if (url.endsWith("/api/watchlist")) return Response.json(display);
    return Response.json({ security: { symbol: url.split("/").pop(), name: "New company", sector: "Information Technology", summary: null } });
  };
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return respond(String(url));
  };
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await loader.cleanup();
});

test("published ranks and ARK/insider values drive rows; metadata cannot add unpublished companies", async () => {
  publication.watchlist.affordable_growing = [
    entry("TWO", 2, { fund_count: 2, funds: ["ARKK", "ARKG"], total_weight: 10.88 }, { buy_count: 3, distinct_insider_count: 2 }),
    entry("ONE", 1),
  ];
  display.affordable_growing = [company("TWO"), company("NOTPUBLISHED"), company("ONE")];
  const data = await api.loadPublishedDashboardPayload();
  assert.deepEqual(data.affordable_growing.map(({ ticker, rank }) => [ticker, rank]), [["ONE", 1], ["TWO", 2]]);
  assert.deepEqual(data.affordable_growing[1].arkSignal, { fundCount: 2, funds: ["ARKK", "ARKG"], totalWeight: 10.88 });
  assert.deepEqual(data.affordable_growing[1].insiderSignal, { buyCount: 3, insiderCount: 2 });
  assert.equal(data.affordable_growing[1].name, "TWO company");
  assert.equal(data.affordable_growing[1].price, "—");
  assert.equal(requests.filter((url) => url.endsWith("/v1/watchlist")).length, 1);
});

test("grouping by selected sectors retains publication rank within each sector and both buckets", async () => {
  publication.watchlist.affordable_growing = [entry("THREE", 3), entry("TWO", 2), entry("ONE", 1)];
  publication.watchlist.popular_stable = [entry("SIX", 2), entry("FIVE", 1)];
  display.affordable_growing = [company("ONE"), company("THREE"), company("TWO", "Healthcare")];
  display.popular_stable = [company("SIX"), company("FIVE")];
  const data = await api.loadPublishedDashboardPayload();
  const grouped = sections(data, ["Healthcare", "Technology"], "affordable_growing");
  assert.deepEqual(grouped.map((section) => [section.name, section.items.map((row) => row.ticker)]), [
    ["Healthcare", ["TWO"]], ["Technology", ["ONE", "THREE"]],
  ]);
  assert.deepEqual(data.popular_stable.map((row) => row.ticker), ["FIVE", "SIX"]);
});

test("missing signals stay null, while reported zero values stay zero", async () => {
  publication.watchlist.affordable_growing = [
    entry("ONE", 1),
    entry("ZERO", 2, { fund_count: 0, funds: [], total_weight: 0 }, { buy_count: 0, distinct_insider_count: 0 }),
  ];
  display.affordable_growing.push(company("ZERO"));
  const { affordable_growing: rows } = await api.loadPublishedDashboardPayload();
  assert.equal(rows[0].arkSignal, null);
  assert.equal(rows[0].insiderSignal, null);
  assert.equal(rows[1].arkSignal.fundCount, 0);
  assert.equal(rows[1].arkSignal.totalWeight, 0);
  assert.equal(rows[1].insiderSignal.buyCount, 0);
  assert.equal(rows[1].insiderSignal.insiderCount, 0);
});

test("a newly published ticker resolves its real name/sector when the display adapter is older", async () => {
  publication.watchlist.affordable_growing.push(entry("NEW", 2));
  const data = await api.loadPublishedDashboardPayload();
  assert.equal(data.affordable_growing[1].name, "New company");
  assert.equal(data.affordable_growing[1].sector, "Technology");
  assert.ok(requests.some((url) => url.endsWith("/v1/securities/NEW")));
});

test("no current publication does not fall back to demo dashboard rows", async () => {
  respond = () => Response.json({ code: "no_current_publication" }, { status: 404 });
  await assert.rejects(api.loadPublishedDashboardPayload(), /No watchlist publication/);
  assert.deepEqual(requests, ["http://test.invalid/v1/watchlist"]);
});

test("invalid ranks or signals cannot silently display fabricated rows", async () => {
  publication.watchlist.affordable_growing[0].rank = null;
  await assert.rejects(api.loadPublishedDashboardPayload(), /response is invalid/);
  publication.watchlist.affordable_growing[0] = entry("ONE", 1, { fund_count: -1, total_weight: 2 });
  await assert.rejects(api.loadPublishedDashboardPayload(), /response is invalid/);
  publication.watchlist.affordable_growing[0] = entry("ONE", 1);
  publication.watchlist.affordable_growing.push(entry("ONE", 2));
  await assert.rejects(api.loadPublishedDashboardPayload(), /response is invalid/);
});

test("failed loads can be retried and successful loads share the short-lived cache", async () => {
  const standard = respond;
  respond = () => Response.json({}, { status: 503 });
  await assert.rejects(api.loadPublishedDashboardPayload(), /503/);
  respond = standard;
  const result = await api.loadPublishedDashboardPayload();
  const count = requests.length;
  assert.equal(await api.loadPublishedDashboardPayload(), result);
  assert.equal(requests.length, count);
});

test("cancelling one subscriber does not cancel another dashboard's shared request", async () => {
  let release;
  const standard = respond;
  respond = async (url) => {
    if (url.endsWith("/v1/watchlist")) await new Promise((resolve) => { release = resolve; });
    return standard(url);
  };
  const controller = new AbortController();
  const first = api.loadPublishedDashboardPayload(controller.signal);
  const second = api.loadPublishedDashboardPayload();
  controller.abort();
  await assert.rejects(first, { name: "AbortError" });
  release();
  assert.equal((await second).affordable_growing[0].ticker, "ONE");
  assert.equal(requests.filter((url) => url.endsWith("/v1/watchlist")).length, 1);
});

test("an already-aborted load makes no API requests", async () => {
  await assert.rejects(api.loadPublishedDashboardPayload(AbortSignal.abort()), { name: "AbortError" });
  assert.equal(requests.length, 0);
});
