// S3-02 AC2: the 30-day trend client (GET /v1/securities/{symbol}/sentiment/trend), its
// states, its text helpers and the chart, rendered to static HTML. No new packages.
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { tsxLoader } from "./render-tsx.mjs";

const originalFetch = globalThis.fetch;
let loader, api, format, Trend, View, render, createElement, calls, reply;

before(async () => {
  loader = await tsxLoader();
  api = await loader.load("src/api/sentimentTrend.ts");
  format = await loader.load("src/lib/sentimentFormat.ts");
  Trend = (await loader.load("src/components/SentimentTrend.tsx")).default;
  ({ SentimentPulseView: View } = await loader.load("src/components/SentimentPulse.tsx"));
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ createElement } = await import("react"));
});
after(() => loader.cleanup());

const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 21);
const date = (offset) => new Date(START + offset * DAY).toISOString().slice(0, 10);
function body(values) {
  return {
    api_version: "v1", symbol: "NVDA", days: values.length, start: date(0), end: date(values.length - 1),
    points: values.map((value, offset) => ({ date: date(offset), value })),
  };
}
const VALUES = Array.from({ length: 30 }, (_, i) => (i % 9 === 2 ? null : Math.round(Math.sin(i / 3) * 40) / 100));
VALUES[29] = 0.32;
VALUES[17] = -0.34;
VALUES[20] = 0;

beforeEach(() => {
  calls = [];
  reply = () => Response.json(body(VALUES));
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return reply();
  };
});
afterEach(() => { globalThis.fetch = originalFetch; });

const text = (markup) => markup.replace(/<[^>]+>/g, " ").replaceAll("&#x27;", "'").replace(/\s+/g, " ").trim();

// ── client ──

test("loadSentimentTrend requests the trend route for the encoded symbol", async () => {
  const trend = await api.loadSentimentTrend("A/B");
  assert.equal(calls[0].url, "http://test.invalid/v1/securities/A%2FB/sentiment/trend");
  assert.equal(trend.points.length, 30);
});

test("loadSentimentTrend passes the abort signal through", async () => {
  const controller = new AbortController();
  globalThis.fetch = async (_url, { signal }) => {
    assert.equal(signal, controller.signal);
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
  };
  const pending = api.loadSentimentTrend("NVDA", controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("a non-2xx answer raises SentimentTrendApiError with its status and code", async () => {
  reply = () => Response.json({ detail: "no security has that ticker", code: "unknown_security" }, { status: 404 });
  await assert.rejects(api.loadSentimentTrend("ZZZZ"), (error) => {
    assert.ok(error instanceof api.SentimentTrendApiError);
    return error.status === 404 && error.code === "unknown_security";
  });
});

test("bodies that could put a bar on the wrong day are refused", async () => {
  const good = body(VALUES);
  const broken = [
    { ...good, symbol: undefined },
    { ...good, days: 31 },
    { ...good, start: "Oct 21" },
    { ...good, end: date(30) },
    { ...good, points: good.points.slice(1) },
    { ...good, points: [...good.points].reverse() },
    { ...good, points: good.points.map((p, i) => (i === 3 ? { ...p, date: date(4) } : p)) },
    { ...good, points: good.points.map((p, i) => (i === 3 ? { ...p, value: 1.5 } : p)) },
    { ...good, points: good.points.map((p, i) => (i === 3 ? { ...p, value: "0.2" } : p)) },
  ];
  for (const candidate of broken) {
    reply = () => Response.json(candidate);
    await assert.rejects(api.loadSentimentTrend("NVDA"), /invalid response/);
  }
  reply = () => new Response("<html>proxy</html>");
  await assert.rejects(api.loadSentimentTrend("NVDA"), /invalid response/);
});

test("the trend state is loading, error, empty (all gaps) or a trend", () => {
  assert.deepEqual(api.sentimentTrendState(null), { kind: "loading" });
  assert.deepEqual(api.sentimentTrendState(null, new Error("x")), { kind: "error" });
  assert.equal(api.sentimentTrendState(body(Array(30).fill(null))).kind, "empty");
  assert.equal(api.sentimentTrendState(body([...Array(29).fill(null), 0])).kind, "trend");
  assert.equal(api.sentimentTrendState(body(VALUES)).kind, "trend");
});

// ── text ──

test("readings are signed with a true minus sign", () => {
  assert.equal(format.formatReading(0.32), "+0.32");
  assert.equal(format.formatReading(-0.344), "−0.34");
  assert.equal(format.formatReading(0), "0.00");
  assert.equal(format.formatReading(-0.001), "0.00");
  assert.equal(format.trendPointText("2026-11-07", -0.34), "Nov 7: −0.34");
  assert.equal(format.trendPointText("2026-11-08", null), "Nov 8: no reading");
});

test("dates sit under the first day, every 7th day and the last", () => {
  assert.deepEqual(format.trendTickIndexes(30), [0, 7, 14, 21, 29]);
  assert.deepEqual(format.trendTickIndexes(1), [0]);
  assert.deepEqual(format.trendTickIndexes(0), []);
});

test("the summary counts days with and without a reading", () => {
  assert.equal(
    format.trendSummary(body([0.1, null, -0.2]).points),
    "3-day sentiment trend, Oct 21 to Oct 23: 2 days with a reading, 1 without. Latest reading Oct 23: −0.20.",
  );
  assert.equal(
    format.trendSummary(body([null, null]).points),
    "2-day sentiment trend, Oct 21 to Oct 22: 0 days with a reading, 2 without.",
  );
});

// ── the chart ──

function chart(values) {
  return render(createElement(Trend, { state: api.sentimentTrendState(body(values)), onRetry: () => {} }));
}

test("one bar or dot per day: green above, red below, a dot for a gap", () => {
  const markup = chart(VALUES);
  const ups = VALUES.filter((v) => v !== null && v >= 0).length;
  const downs = VALUES.filter((v) => v !== null && v < 0).length;
  const gaps = VALUES.filter((v) => v === null).length;
  assert.equal(markup.match(/class="sentiment-trend-up"/g).length, ups);
  assert.equal(markup.match(/class="sentiment-trend-down"/g).length, downs);
  assert.equal(markup.match(/class="sentiment-trend-gap"/g).length, gaps);
  assert.equal(ups + downs + gaps, 30);
});

test("bars grow from the zero line on a fixed −1 to +1 scale", () => {
  const markup = chart([1, -1, 0.5, 0, null]);
  const rects = [...markup.matchAll(/<rect class="sentiment-trend-(up|down)"[^>]*y="([\d.]+)" height="([\d.]+)"/g)]
    .map(([, kind, y, height]) => ({ kind, y: Number(y), height: Number(height) }));
  assert.deepEqual(rects, [
    { kind: "up", y: 4, height: 96 }, // +1: from the line (100) to the top
    { kind: "down", y: 100, height: 96 }, // −1: from the line down
    { kind: "up", y: 52, height: 48 }, // +0.5: half
    { kind: "up", y: 98, height: 2 }, // a true 0 keeps a sliver, unlike a gap
  ]);
});

test("each bar carries its date and value, and the chart a summary", () => {
  const markup = chart(VALUES);
  assert.match(markup, /<title>Nov 19: \+0\.32<\/title>/);
  assert.match(markup, /<title>Nov 7: −0\.34<\/title>/);
  assert.match(markup, /<title>Nov 10: 0\.00<\/title>/);
  assert.match(markup, /<title>Oct 23: no reading<\/title>/);
  assert.match(markup, /role="img" aria-label="30-day sentiment trend, Oct 21 to Nov 19: \d+ days with a reading/);
  const shown = text(markup);
  assert.match(shown, /30-day trend/);
  assert.match(shown, /Oct 21 Oct 28 Nov 4 Nov 11 Nov 19/);
  assert.match(shown, /\+1 0 −1/);
  assert.match(shown, /Positive Negative No reading that day/);
});

test("loading, error with Retry, and a month without readings", () => {
  const loading = render(createElement(Trend, { state: { kind: "loading" }, onRetry: () => {} }));
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /loading-bar/);
  assert.doesNotMatch(loading, /<rect/);

  let retries = 0;
  const failed = createElement(Trend, { state: { kind: "error" }, onRetry: () => { retries += 1; } });
  assert.match(text(render(failed)), /The 30-day trend couldn't be loaded\. Retry/);
  // Press Retry by walking the element tree (no DOM).
  const expand = (node) => (typeof node?.type === "function" ? expand(node.type(node.props)) : node);
  const find = (node) => {
    node = expand(node);
    if (!node || typeof node !== "object") return null;
    if (node.type === "button") return node;
    const children = [node.props?.children].flat(Infinity);
    for (const child of children) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  };
  find(failed).props.onClick();
  assert.equal(retries, 1);

  const empty = text(chart(Array(30).fill(null)));
  assert.match(empty, /No readings in the last 30 days\./);
});

test("the card shows the trend under the bars, the same on both tabs, in every bar state", () => {
  const trend = api.sentimentTrendState(body(VALUES));
  const reading = { kind: "reading", reading: {
    api_version: "v1", symbol: "NVDA", status: "ok", tallied_on: "2026-11-17", min_items: 3,
    news: { status: "ok", weighted: true, count: 3, first_at: null, last_at: null,
      counts: { positive: 3, neutral: 0, negative: 0 }, shares: { positive: 1, neutral: 0, negative: 0 } },
    social: { status: "not_enough_coverage", weighted: false, count: 0, first_at: null, last_at: null,
      counts: { positive: 0, neutral: 0, negative: 0 }, shares: null },
  } };
  const card = (state, channel) => render(createElement(View, {
    state, channel, onChannel: () => {}, onRetry: () => {}, trend, onRetryTrend: () => {},
  }));
  const news = card(reading, "news");
  const chartOf = (markup) => markup.slice(markup.indexOf('class="sentiment-trend"'));
  assert.ok(news.indexOf("sentiment-bars") < news.indexOf('class="sentiment-trend"'));
  assert.equal(chartOf(card(reading, "social")), chartOf(news));
  for (const state of [{ kind: "loading" }, { kind: "error" }, { kind: "unavailable", reason: "no_breakdown" }]) {
    assert.match(card(state, "news"), /sentiment-trend-up/);
  }
});
