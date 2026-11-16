// S3-06: Remove Tickers from Watchlist. AC 1 (DELETE runs, the ticker leaves the list),
// AC 2 (Undo restores it), AC 4 (removing an absent ticker is a 204 and changes nothing)
// and AC 5 (a failed call leaves the list alone), with Node's built-in runner.
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsxLoader } from "./render-tsx.mjs";

const originalFetch = globalThis.fetch;
let loader, lib, api, shell, calls, respond;

before(async () => {
  const storage = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  globalThis.window ??= new EventTarget();
  loader = await tsxLoader();
  lib = await loader.load("src/lib/watchlistRemoval.ts");
  api = await loader.load("src/api/auth.ts");
  shell = await loader.load("src/components/AppShell.tsx");
});

beforeEach(() => {
  calls = [];
  respond = () => new Response(null, { status: 204 });
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method ?? "GET", body: init.body, auth: new Headers(init.headers).get("Authorization") });
    return respond();
  };
});

after(async () => {
  globalThis.fetch = originalFetch;
  await loader.cleanup();
});

const remote = (name) => (ticker) => api[name](ticker, "token");

test("AC 1: removing runs DELETE /v1/me/watchlist/{ticker}, then the ticker leaves the list", async () => {
  const before = ["AAPL", "NVDA", "TTD"];
  const { tickers, removal } = await lib.removeTicker(before, "NVDA", remote("removeFromWatchlist"));
  assert.deepEqual(calls, [{ url: "http://test.invalid/v1/me/watchlist/NVDA", method: "DELETE", body: undefined, auth: "Bearer token" }]);
  assert.deepEqual(tickers, ["AAPL", "TTD"]);
  assert.deepEqual(removal, { ticker: "NVDA", index: 1 });
  assert.deepEqual(before, ["AAPL", "NVDA", "TTD"]); // the caller's list isn't mutated
});

test("AC 1: a share-class ticker is sent as one path segment", async () => {
  await lib.removeTicker(["BRK.B", "A/B"], "A/B", remote("removeFromWatchlist"));
  assert.equal(calls[0].url, "http://test.invalid/v1/me/watchlist/A%2FB");
});

test("AC 2: Undo saves the ticker again and puts it back where it was", async () => {
  const { tickers, removal } = await lib.removeTicker(["AAPL", "NVDA", "TTD"], "NVDA", remote("removeFromWatchlist"));
  respond = () => Response.json({ ticker: "NVDA" }, { status: 201 });
  const restored = await lib.restoreTicker(tickers, removal, remote("addToWatchlist"));
  assert.deepEqual(restored, ["AAPL", "NVDA", "TTD"]);
  assert.deepEqual(calls[1], { url: "http://test.invalid/v1/me/watchlist", method: "POST", body: JSON.stringify({ ticker: "NVDA" }), auth: "Bearer token" });
});

test("AC 2: Undo is offered for 5 seconds", () => {
  assert.equal(lib.UNDO_WINDOW_MS, 5000);
});

test("AC 2: a failed Undo rejects and leaves the ticker off the list", async () => {
  respond = () => Response.json({ detail: "down" }, { status: 503 });
  await assert.rejects(lib.restoreTicker(["AAPL"], { ticker: "NVDA", index: 1 }, remote("addToWatchlist")), { status: 503 });
});

test("AC 2: restoring never duplicates, and an out-of-range place is clamped", () => {
  assert.deepEqual(lib.withTickerAt(["AAPL", "NVDA"], "NVDA", 0), ["AAPL", "NVDA"]);
  assert.deepEqual(lib.withTickerAt(["AAPL"], "NVDA", 9), ["AAPL", "NVDA"]);
  assert.deepEqual(lib.withTickerAt(["AAPL"], "NVDA", -1), ["NVDA", "AAPL"]);
  assert.deepEqual(lib.withTickerAt([], "NVDA", Number.NaN), ["NVDA"]);
});

test("AC 2: each removal keeps its own 5 seconds, and one Undo restores all still inside it", async () => {
  const first = { ticker: "AAPL", index: 0 };
  const second = { ticker: "NVDA", index: 0 };
  let entries = lib.withUndoable([], first, 1000);
  entries = lib.withUndoable(entries, second, 4000);
  assert.deepEqual(entries, [{ removal: first, expiresAt: 6000 }, { removal: second, expiresAt: 9000 }]);
  assert.deepEqual(lib.undoable(entries, 5999).map((entry) => entry.removal.ticker), ["AAPL", "NVDA"]);
  assert.deepEqual(lib.undoable(entries, 6000).map((entry) => entry.removal.ticker), ["NVDA"]); // 5 s exactly: gone
  assert.deepEqual(lib.undoable(entries, 9000), []);
  assert.deepEqual(lib.withUndoable(entries, { ticker: "TTD", index: 0 }, 7000).map((entry) => entry.removal.ticker), ["NVDA", "TTD"]);

  // Newest first, so each ticker returns to the place it was taken from.
  let list = ["TTD"]; // was AAPL, NVDA, TTD
  const outcome = await lib.restoreAll(entries, async (removal) => { list = lib.withTickerAt(list, removal.ticker, removal.index); });
  assert.deepEqual(list, ["AAPL", "NVDA", "TTD"]);
  assert.deepEqual(outcome, { restored: ["NVDA", "AAPL"], failed: [] });
});

test("AC 2: when one of several restores fails, the others still come back and the failure is named", async () => {
  const entries = [{ removal: { ticker: "AAPL", index: 0 }, expiresAt: 1 }, { removal: { ticker: "NVDA", index: 0 }, expiresAt: 2 }];
  const outcome = await lib.restoreAll(entries, async (removal) => { if (removal.ticker === "NVDA") throw new Error("down"); });
  assert.deepEqual(outcome, { restored: ["AAPL"], failed: ["NVDA"] });
});

test("AC 4: removing a ticker that is already gone is a 204 and the list is unchanged", async () => {
  const { tickers } = await lib.removeTicker(["AAPL", "TTD"], "NVDA", remote("removeFromWatchlist"));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "DELETE");
  assert.deepEqual(tickers, ["AAPL", "TTD"]);
});

for (const status of [500, 503, 429, 422]) {
  test(`AC 5: a ${status} from the API rejects, so the ticker stays on the list`, async () => {
    respond = () => Response.json({ detail: "no" }, { status });
    await assert.rejects(lib.removeTicker(["AAPL", "NVDA"], "NVDA", remote("removeFromWatchlist")), { status });
  });
}

test("AC 5: a network failure rejects, so the ticker stays on the list", async () => {
  respond = () => { throw new TypeError("fetch failed"); };
  await assert.rejects(lib.removeTicker(["AAPL", "NVDA"], "NVDA", remote("removeFromWatchlist")), TypeError);
});

test("with no API session the list still changes and nothing is requested", async () => {
  const { tickers, removal } = await lib.removeTicker(["AAPL", "NVDA"], "AAPL", null);
  assert.deepEqual(tickers, ["NVDA"]);
  assert.deepEqual(await lib.restoreTicker(tickers, removal, null), ["AAPL", "NVDA"]);
  assert.equal(calls.length, 0);
});

test("AC 2: the removal toast carries an Undo button; a plain toast has none", () => {
  const toast = (props) => renderToStaticMarkup(createElement(shell.Toast, { onDone() {}, ...props }));
  const removed = toast({ type: "success", message: "Removed NVDA from your Watchlist", action: { label: "Undo", onAction() {} } });
  assert.match(removed, /Removed NVDA from your Watchlist/);
  assert.match(removed, /<button class="toast-action" type="button">Undo<\/button>/);
  assert.match(removed, /role="status"/);
  const failed = toast({ type: "error", message: "Couldn't remove NVDA. It is still on your Watchlist." });
  assert.doesNotMatch(failed, /<button/);
  assert.match(failed, /role="alert"/);
});
