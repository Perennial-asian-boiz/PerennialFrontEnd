// S3-02 piece 1: the Sentiment Pulse client (GET /v1/securities/{symbol}/sentiment), its states
// and the pure text/number helpers, tested with Node's runner and no new packages.
// Contract: backend docs/technical-specs/SENTIMENT_PULSE.md §6.1.
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { tsxLoader } from "./render-tsx.mjs";

const originalFetch = globalThis.fetch;
let loader, api, format, calls, reply;

before(async () => {
  loader = await tsxLoader();
  api = await loader.load("src/api/sentiment.ts");
  format = await loader.load("src/lib/sentimentFormat.ts");
});
after(() => loader.cleanup());

const READING = {
  api_version: "v1", symbol: "NVDA", status: "ok", tallied_on: "2026-11-17", min_items: 3,
  news: {
    status: "ok", weighted: true, count: 13,
    first_at: "2026-11-10T14:02:00+00:00", last_at: "2026-11-17T09:30:00+00:00",
    counts: { positive: 8, neutral: 3, negative: 2 },
    shares: { positive: 0.618, neutral: 0.251, negative: 0.131 },
  },
  social: {
    status: "not_enough_coverage", weighted: false, count: 1,
    first_at: "2026-11-17T23:59:59+00:00", last_at: "2026-11-17T23:59:59+00:00",
    counts: { positive: 1, neutral: 0, negative: 0 }, shares: null,
  },
};

beforeEach(() => {
  calls = [];
  reply = () => Response.json(READING);
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return reply();
  };
});
afterEach(() => { globalThis.fetch = originalFetch; });

test("loadSentiment requests the sentiment route for the encoded symbol", async () => {
  const body = await api.loadSentiment("BRK.B");
  assert.equal(body.status, "ok");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.invalid/v1/securities/BRK.B/sentiment");
  await api.loadSentiment("A/B");
  assert.equal(calls[1].url, "http://test.invalid/v1/securities/A%2FB/sentiment");
});

test("loadSentiment passes the abort signal through", async () => {
  const controller = new AbortController();
  globalThis.fetch = async (_url, { signal }) => {
    assert.equal(signal, controller.signal);
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
  };
  const pending = api.loadSentiment("NVDA", controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("a non-2xx answer raises SentimentApiError with its status and code", async () => {
  reply = () => Response.json({ detail: "no security has that ticker", code: "unknown_security" }, { status: 404 });
  await assert.rejects(api.loadSentiment("ZZZZ"), (error) => {
    assert.ok(error instanceof api.SentimentApiError);
    assert.equal(error.status, 404);
    assert.equal(error.code, "unknown_security");
    return true;
  });
  reply = () => new Response("<html>bad gateway</html>", { status: 502 });
  await assert.rejects(api.loadSentiment("NVDA"), (error) => error.status === 502 && error.code === null);
});

test("non-JSON and malformed bodies are refused, never shown", async () => {
  reply = () => new Response("<html>proxy</html>", { status: 200 });
  await assert.rejects(api.loadSentiment("NVDA"), /invalid response/);
  const broken = [
    { ...READING, symbol: undefined },
    { ...READING, status: "maybe" },
    { ...READING, tallied_on: "Nov 17" },
    { ...READING, min_items: "3" },
    { ...READING, news: undefined },
    { ...READING, news: { ...READING.news, shares: null } },
    { ...READING, news: { ...READING.news, shares: { positive: 1.5, neutral: 0, negative: 0 } } },
    { ...READING, news: { ...READING.news, counts: { positive: 8, neutral: 3 } } },
    { ...READING, news: { ...READING.news, count: 99 } },
    { ...READING, social: { ...READING.social, shares: { positive: 1, neutral: 0, negative: 0 } } },
    { ...READING, social: { ...READING.social, first_at: "yesterday" } },
  ];
  for (const body of broken) {
    reply = () => Response.json(body);
    await assert.rejects(api.loadSentiment("NVDA"), /invalid response/, JSON.stringify(body).slice(0, 80));
  }
});

test("both unavailable reasons are valid bodies", async () => {
  for (const reason of ["no_reading", "no_breakdown"]) {
    reply = () => Response.json({ api_version: "v1", symbol: "NVDA", status: "unavailable", reason });
    assert.equal((await api.loadSentiment("NVDA")).reason, reason);
  }
});

test("sentimentState maps loading, reading, unavailable and every error", () => {
  assert.deepEqual(api.sentimentState(null), { kind: "loading" });
  assert.equal(api.sentimentState(READING).kind, "reading");
  assert.equal(api.sentimentState(READING).reading.news.count, 13);
  assert.deepEqual(
    api.sentimentState({ api_version: "v1", symbol: "NVDA", status: "unavailable", reason: "no_breakdown" }),
    { kind: "unavailable", reason: "no_breakdown" },
  );
  assert.deepEqual(api.sentimentState(null, new api.SentimentApiError("x", 404, "unknown_security")), { kind: "error" });
  assert.deepEqual(api.sentimentState(null, new TypeError("Failed to fetch")), { kind: "error" });
});

test("whole percents use the largest remainder and always add to 100", () => {
  assert.deepEqual(format.wholePercents({ positive: 0.3333, neutral: 0.3333, negative: 0.3334 }), { positive: 33, neutral: 33, negative: 34 });
  assert.deepEqual(format.wholePercents({ positive: 0.618, neutral: 0.251, negative: 0.131 }), { positive: 62, neutral: 25, negative: 13 });
  assert.deepEqual(format.wholePercents({ positive: 1, neutral: 0, negative: 0 }), { positive: 100, neutral: 0, negative: 0 });
  assert.deepEqual(format.wholePercents({ positive: 0, neutral: 0, negative: 0 }), { positive: 0, neutral: 0, negative: 0 });
  assert.deepEqual(format.wholePercents({ positive: 0.005, neutral: 0.005, negative: 0.99 }), { positive: 1, neutral: 0, negative: 99 });
  // Shares rounded to 4 places can sum to 0.9999 or 1.0001; the percents still add to 100.
  let seed = 42;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 500; i += 1) {
    const a = Math.round(random() * 10000) / 10000;
    const b = Math.round(random() * (1 - a) * 10000) / 10000;
    const c = Math.max(0, Math.round((1 - a - b + (random() - 0.5) * 0.0002) * 10000) / 10000);
    const shown = format.wholePercents({ positive: a, neutral: b, negative: c });
    if (a + b + c === 0) continue;
    assert.equal(shown.positive + shown.neutral + shown.negative, 100, JSON.stringify([a, b, c]));
  }
});

test("captions name the label and count, singular and plural", () => {
  assert.equal(format.captionText("positive", 8, "news"), "Positive · 8 articles");
  assert.equal(format.captionText("neutral", 1, "news"), "Neutral · 1 article");
  assert.equal(format.captionText("negative", 0, "social"), "Negative · 0 posts");
  assert.equal(format.captionText("neutral", 1, "social"), "Neutral · 1 post");
});

test("source lines give the count, date range and tally date", () => {
  assert.equal(
    format.sourceLine("news", 13, "2026-11-10T14:02:00+00:00", "2026-11-17T09:30:00+00:00", "2026-11-17"),
    "Based on 13 articles, Nov 10–17 · tallied Nov 17",
  );
  assert.equal(
    format.sourceLine("news", 4, "2026-10-30T14:02:00+00:00", "2026-11-02T09:30:00+00:00", "2026-11-17"),
    "Based on 4 articles, Oct 30–Nov 2 · tallied Nov 17",
  );
  assert.equal(
    format.sourceLine("social", 6, "2026-11-17T23:59:59+00:00", "2026-11-17T23:59:59+00:00", "2026-11-17"),
    "Based on 6 posts collected Nov 17 · tallied Nov 17",
  );
  assert.equal(
    format.sourceLine("news", 3, "2026-11-17T01:00:00+00:00", "2026-11-17T20:00:00+00:00", "2026-11-17"),
    "Based on 3 articles, Nov 17 · tallied Nov 17",
  );
  assert.equal(format.sourceLine("news", 3, null, null, "2026-11-17"), "Based on 3 articles · tallied Nov 17");
});

test("dates are UTC calendar days, so the tally date never shifts a day", () => {
  assert.equal(format.formatDay("2026-11-17"), "Nov 17");
  assert.equal(format.formatDay("2026-11-17T23:59:59+00:00"), "Nov 17");
  assert.equal(format.formatDay("not a date"), null);
  assert.equal(format.formatDay(null), null);
});

test("coverage text says how many items a tab has of the minimum", () => {
  assert.equal(format.coverageText("news", 2, 3), "2 of 3 articles needed");
  assert.equal(format.coverageText("social", 0, 3), "0 of 3 posts needed");
});
