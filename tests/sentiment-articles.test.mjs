// S3-02 AC3: the top-articles client (GET /v1/securities/{symbol}/sentiment/articles), its
// states, its text helpers and the list in the card, rendered to static HTML. No new packages.
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { tsxLoader } from "./render-tsx.mjs";

const originalFetch = globalThis.fetch;
let loader, api, format, List, View, render, createElement, calls, reply;

before(async () => {
  loader = await tsxLoader();
  api = await loader.load("src/api/sentimentArticles.ts");
  format = await loader.load("src/lib/sentimentFormat.ts");
  List = (await loader.load("src/components/TopArticles.tsx")).default;
  ({ SentimentPulseView: View } = await loader.load("src/components/SentimentPulse.tsx"));
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ createElement } = await import("react"));
});
after(() => loader.cleanup());

const ARTICLES = [
  { rank: 1, headline: "NVIDIA beats estimates", outlet: "Reuters", url: "https://finnhub.io/api/news?id=1",
    published_at: "2026-11-17T09:30:00+00:00", label: "positive", weight: 0.82, share: 0.2104 },
  { rank: 2, headline: "Export curbs could weigh on sales", outlet: "The Wall Street Journal", url: "https://example.com/2",
    published_at: "2026-11-15T11:00:00+00:00", label: "negative", weight: 0.47, share: 0.1052 },
  { rank: 3, headline: "New networking chips", outlet: "CNBC", url: "javascript:alert(1)",
    published_at: "2026-11-14T18:45:00+00:00", label: "neutral", weight: 0.01, share: 0.003 },
];
const OK = { api_version: "v1", symbol: "NVDA", status: "ok", tallied_on: "2026-11-17", count: 13, articles: ARTICLES };

beforeEach(() => {
  calls = [];
  reply = () => Response.json(OK);
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return reply();
  };
});
afterEach(() => { globalThis.fetch = originalFetch; });

const text = (markup) => markup.replace(/<[^>]+>/g, " ").replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replace(/\s+/g, " ").trim();

// ── client ──

test("loadSentimentArticles requests the articles route for the encoded symbol", async () => {
  const body = await api.loadSentimentArticles("A/B");
  assert.equal(calls[0].url, "http://test.invalid/v1/securities/A%2FB/sentiment/articles");
  assert.equal(body.articles.length, 3);
});

test("loadSentimentArticles passes the abort signal through", async () => {
  const controller = new AbortController();
  globalThis.fetch = async (_url, { signal }) => {
    assert.equal(signal, controller.signal);
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
  };
  const pending = api.loadSentimentArticles("NVDA", controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("a non-2xx answer raises SentimentArticlesApiError with its status and code", async () => {
  reply = () => Response.json({ code: "unknown_security" }, { status: 404 });
  await assert.rejects(api.loadSentimentArticles("ZZZZ"), (error) =>
    error instanceof api.SentimentArticlesApiError && error.status === 404 && error.code === "unknown_security");
});

test("malformed bodies are refused", async () => {
  const broken = [
    { ...OK, symbol: undefined },
    { ...OK, count: -1 },
    { ...OK, count: 2 },
    { ...OK, articles: [...ARTICLES, ...ARTICLES] },
    { ...OK, articles: [ARTICLES[1]] },
    { ...OK, articles: [{ ...ARTICLES[0], label: "mixed" }] },
    { ...OK, articles: [{ ...ARTICLES[0], share: 1.5 }] },
    { ...OK, articles: [{ ...ARTICLES[0], headline: " " }] },
    { ...OK, articles: [{ ...ARTICLES[0], published_at: "yesterday" }] },
  ];
  for (const body of broken) {
    reply = () => Response.json(body);
    await assert.rejects(api.loadSentimentArticles("NVDA"), /invalid response/);
  }
});

test("the state is loading, error, none (unavailable or no articles) or articles", () => {
  assert.deepEqual(api.sentimentArticlesState(null), { kind: "loading" });
  assert.deepEqual(api.sentimentArticlesState(null, new Error("x")), { kind: "error" });
  assert.deepEqual(api.sentimentArticlesState({ api_version: "v1", symbol: "N", status: "unavailable", reason: "no_reading" }), { kind: "none" });
  assert.deepEqual(api.sentimentArticlesState({ ...OK, count: 0, articles: [] }), { kind: "none" });
  assert.deepEqual(api.sentimentArticlesState(OK), { kind: "articles", count: 13, articles: ARTICLES });
});

test("only http and https links are links", () => {
  assert.equal(api.safeArticleUrl("https://finnhub.io/api/news?id=1"), "https://finnhub.io/api/news?id=1");
  assert.equal(api.safeArticleUrl("http://example.com/a"), "http://example.com/a");
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "example.com", "", "ftp://x/y"]) {
    assert.equal(api.safeArticleUrl(bad), null, bad);
  }
});

test("shares are whole percents, with a sliver shown as <1%", () => {
  assert.equal(format.shareText(0.2104), "21%");
  assert.equal(format.shareText(0.075), "8%");
  assert.equal(format.shareText(0.003), "<1%");
  assert.equal(format.shareText(0), "0%");
  assert.equal(format.articleMeta("Reuters", "2026-11-17T09:30:00+00:00"), "Reuters · Nov 17");
  assert.equal(format.articleMeta("Reuters", "bad"), "Reuters");
});

// ── the list ──

const listOf = (state) => render(createElement(List, { state, onRetry: () => {} }));

test("each row: rank, headline linking out, outlet and date, label, share of weight", () => {
  const markup = listOf(api.sentimentArticlesState(OK));
  const shown = text(markup);
  assert.match(shown, /Top contributing articles/);
  assert.match(shown, /1 NVIDIA beats estimates ↗ \(opens in a new tab\) Reuters · Nov 17 Positive 21% of weight/);
  assert.match(shown, /2 Export curbs could weigh on sales .* The Wall Street Journal · Nov 15 Negative 11% of weight/);
  assert.match(markup, /<a class="top-articles-headline" href="https:\/\/finnhub.io\/api\/news\?id=1" target="_blank" rel="noopener noreferrer">/);
  assert.match(shown, /13 articles counted in all\./);
  assert.match(markup, /class="top-articles-pill negative"/);
});

test("an unsafe link leaves the headline as plain text", () => {
  const markup = listOf(api.sentimentArticlesState(OK));
  assert.doesNotMatch(markup, /javascript:/);
  assert.match(markup, /<span class="top-articles-headline">New networking chips<\/span>/);
  assert.match(text(markup), /<1% of weight/);
});

test("meters are relative to the heaviest article", () => {
  const widths = [...listOf(api.sentimentArticlesState(OK)).matchAll(/<i style="width:(\d+)%"/g)].map((m) => Number(m[1]));
  assert.deepEqual(widths, [100, 50, 1]);
});

test("loading, error with Retry, and nothing at all when there are no articles", () => {
  assert.match(listOf({ kind: "loading" }), /aria-busy="true"/);
  assert.match(text(listOf({ kind: "error" })), /The top articles couldn't be loaded\. Retry/);
  assert.equal(listOf({ kind: "none" }), "");
  let retries = 0;
  const element = createElement(List, { state: { kind: "error" }, onRetry: () => { retries += 1; } });
  const expand = (node) => (typeof node?.type === "function" ? expand(node.type(node.props)) : node);
  const find = (node) => {
    node = expand(node);
    if (!node || typeof node !== "object") return null;
    if (node.type === "button") return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  };
  find(element).props.onClick();
  assert.equal(retries, 1);
});

// ── in the card ──

const reading = (newsStatus = "ok") => ({ kind: "reading", reading: {
  api_version: "v1", symbol: "NVDA", status: "ok", tallied_on: "2026-11-17", min_items: 3,
  news: { status: newsStatus, weighted: true, count: 13, first_at: null, last_at: null,
    counts: { positive: 8, neutral: 3, negative: 2 },
    shares: newsStatus === "ok" ? { positive: 0.618, neutral: 0.251, negative: 0.131 } : null },
  social: { status: "ok", weighted: false, count: 4, first_at: null, last_at: null,
    counts: { positive: 2, neutral: 1, negative: 1 }, shares: { positive: 0.5, neutral: 0.25, negative: 0.25 } },
} });
const card = (state, channel, trend = { kind: "loading" }) => render(createElement(View, {
  state, channel, onChannel: () => {}, onRetry: () => {},
  trend, onRetryTrend: () => {},
  articles: api.sentimentArticlesState(OK), onRetryArticles: () => {},
}));

test("the list sits on the News tab, between the bars and the trend", () => {
  const markup = card(reading(), "news");
  const bars = markup.indexOf("sentiment-bars");
  const list = markup.indexOf('class="top-articles"');
  const trend = markup.indexOf('class="sentiment-trend"');
  assert.ok(bars >= 0 && bars < list && list < trend, `${bars} ${list} ${trend}`);
});

test("the list is hidden on Social, without News coverage and without a reading", () => {
  assert.doesNotMatch(card(reading(), "social"), /top-articles/);
  assert.doesNotMatch(card(reading("not_enough_coverage"), "news"), /top-articles/);
  for (const state of [{ kind: "loading" }, { kind: "error" }, { kind: "unavailable", reason: "no_reading" }]) {
    assert.doesNotMatch(card(state, "news"), /top-articles/);
  }
});
