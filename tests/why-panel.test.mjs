// S2-03: the why-panel (AC1: up to 3 supporting signals in plain language; AC2: each claim
// cites its stored record and as-of; AC3: no claim about an unavailable component; AC5:
// "Explanation unavailable"), rendered to static HTML with react-dom/server.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { tsxLoader } from "./render-tsx.mjs";

let loader;
let api;
let WhyPanel;
let render;
let createElement;

before(async () => {
  loader = await tsxLoader();
  api = await loader.load("src/api/score.ts");
  WhyPanel = (await loader.load("src/components/WhyPanel.tsx")).default;
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ createElement } = await import("react"));
});
after(() => loader.cleanup());

const STAMP = "2026-11-05T17:02:11+00:00";
const component = (name, status = "ok") => ({
  name, status, value: status === "ok" ? 70 : null, nominal_weight: 0.3, weight: status === "ok" ? 0.5 : 0,
  contribution: status === "ok" ? 35 : 0, input_as_of: null, input_version: null, record: null,
});
const claim = (order, text, componentName = "fundamentals") => ({
  order, text, component: componentName, measure: "operating_margin",
  record: { table: "fundamental_scores", id: 812, batch_id: 5 }, as_of: "2025-06-30", value: "0.420000",
});

// The mock's ZZSA, trimmed to what the panel reads.
const recommended = (claims, overrides = {}) => ({
  api_version: "v1", symbol: "ZZSA",
  score: {
    status: "ok", value: 74.3, score_version: "score-v1", as_of: STAMP, recommended: true,
    components: [component("fundamentals"), component("sentiment"), component("event_exposure", "unavailable")],
    missing: ["event_exposure"], ...overrides,
  },
  explanation: { status: "ok", template_version: "explain-v1", as_of: STAMP, claims },
});
const withExplanation = (explanation) => ({ ...recommended([]), explanation });

const panel = (response, error) => render(createElement(WhyPanel, { state: api.scoreState(response, error) }));
const claimTexts = (html) => [...html.matchAll(/class="why-claim-text">([^<]*)</g)].map((match) => match[1]);

// ── AC1: up to three supporting signals ──────────────────

test("a recommended company shows its claims in order, in plain language (03-AC1)", () => {
  const html = panel(recommended([
    claim(2, "Revenue grew 25% a year over the last 3 years."),
    claim(1, "Keeps 42 cents of every sales dollar as operating profit."),
    claim(3, "News coverage over the last 7 days leaned positive (12 articles).", "sentiment"),
  ]));
  assert.deepEqual(claimTexts(html), [
    "Keeps 42 cents of every sales dollar as operating profit.",
    "Revenue grew 25% a year over the last 3 years.",
    "News coverage over the last 7 days leaned positive (12 articles).",
  ]);
  assert.doesNotMatch(html, /Explanation unavailable/);
});

test("no more than three claims are shown (03-AC1)", () => {
  const html = panel(recommended([1, 2, 3, 4].map((order) => claim(order, `Claim ${order}`))));
  assert.deepEqual(claimTexts(html), ["Claim 1", "Claim 2", "Claim 3"]);
});

// ── AC2: each claim's source and as-of ───────────────────

test("each claim cites its component, stored record, value and as-of (03-AC2)", () => {
  const html = panel(recommended([claim(1, "Keeps 42 cents of every sales dollar as operating profit.")]));
  assert.match(html, /Fundamentals · as of 2025-06-30/);
  assert.match(html, /fundamental_scores #812, batch 5/);
  assert.match(html, /operating margin/);
  assert.match(html, /0\.420000/);
  assert.match(html, /explain-v1 · as of Nov 5, 2026, 12:02 PM EST/);
});

// ── AC3: never a claim about an unavailable component ────

test("a claim about a missing or unavailable component is not shown (03-AC3)", () => {
  const html = panel(recommended([
    claim(1, "Supported by fundamentals."),
    claim(2, "About event exposure.", "event_exposure"),
    claim(3, "About an unknown component.", "insider_trades"),
  ]));
  assert.deepEqual(claimTexts(html), ["Supported by fundamentals."]);
});

test("if no claim survives, the explanation reads as unavailable (03-AC3, AC5)", () => {
  const html = panel(recommended([claim(1, "About event exposure.", "event_exposure")]));
  assert.deepEqual(claimTexts(html), []);
  assert.match(html, /Explanation unavailable/);
  assert.match(html, /enough supporting data/);
});

// ── AC5: "Explanation unavailable" ───────────────────────

for (const [reason, detail] of [
  ["insufficient_supporting_data", "There isn't enough supporting data to explain this recommendation."],
  ["not_explained_yet", "This score hasn't been explained yet. Please check back later."],
  ["something_new", "An explanation isn't available for this company yet."],
]) {
  test(`an unavailable explanation (${reason}) says so and makes no claim (03-AC5)`, () => {
    const html = panel(withExplanation({ status: "unavailable", reason, claims: [] }));
    assert.match(html, /Explanation unavailable/);
    assert.ok(html.includes(detail.replaceAll("'", "&#x27;")), html);
    assert.deepEqual(claimTexts(html), []);
  });
}

test("a company scored below 60 is labeled not recommended, with no claims", () => {
  const html = panel(withExplanation({ status: "not_recommended", template_version: "explain-v1", claims: [] }));
  assert.match(html, /Not recommended/);
  assert.match(html, /at least 60/);
  assert.deepEqual(claimTexts(html), []);
});

test("an unavailable score has no explanation", () => {
  const html = panel({
    api_version: "v1", symbol: "ZZOF",
    score: {
      status: "unavailable", reason: "only_fundamentals", value: null, score_version: "score-v1", as_of: STAMP,
      recommended: false, components: [], missing: ["sentiment", "event_exposure"],
    },
    explanation: { status: "unavailable", reason: "score_unavailable", claims: [] },
  });
  assert.match(html, /Explanation unavailable/);
  assert.match(html, /because the score is unavailable/);
});

// ── the heading never contradicts the panel ──────────────

const heading = (html) => html.match(/id="why-panel-heading">([^<]*)</)[1];

test("only a panel with claims is headed \"Why Perennial recommends it\"", () => {
  assert.equal(heading(panel(recommended([claim(1, "Supported by fundamentals.")]))), "Why Perennial recommends it");
  for (const html of [
    panel(withExplanation({ status: "not_recommended", template_version: "explain-v1", claims: [] })),
    panel(withExplanation({ status: "unavailable", reason: "insufficient_supporting_data", claims: [] })),
    panel(recommended([claim(1, "About event exposure.", "event_exposure")])),
    panel(null),
    panel(null, new api.ScoreApiError("Score API returned 500", 500, "internal_error")),
  ]) {
    assert.equal(heading(html), "Recommendation");
  }
});

// ── the other states ─────────────────────────────────────

test("loading, an unknown company and a failed request show no claims", () => {
  const loading = panel(null);
  assert.match(loading, /Loading explanation…/);
  assert.match(loading, /aria-busy="true"/);
  const notFound = panel(null, new api.ScoreApiError("Score API returned 404", 404, "unknown_security"));
  assert.match(notFound, /isn(&#x27;|')t in Perennial yet/);
  const failed = panel(null, new api.ScoreApiError("Score API returned 500", 500, "internal_error"));
  assert.match(failed, /role="alert"/);
  for (const html of [loading, notFound, failed]) assert.deepEqual(claimTexts(html), []);
});
