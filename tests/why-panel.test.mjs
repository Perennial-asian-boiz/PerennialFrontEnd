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

test("tapping a claim shows its component, stored record, value and as-of (03-AC2)", () => {
  const html = panel(recommended([claim(1, "Keeps 42 cents of every sales dollar as operating profit.")]));
  assert.match(html, /<details class="why-reason"><summary>/);
  const source = html.match(/<dl class="why-claim-source">(.*?)<\/dl>/)[1];
  assert.match(source, /<dt>Component<\/dt><dd>Fundamentals<\/dd>/);
  assert.match(source, /fundamental_scores #812, batch 5/);
  assert.match(source, /operating margin/);
  assert.match(source, /0\.420000/);
  assert.match(source, /<dt>As of<\/dt><dd>2025-06-30<\/dd>/);
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

// ── only a recommended company gets a card ───────────────

test("a company that isn't recommended gets no card at all", () => {
  assert.equal(panel(withExplanation({ status: "not_recommended", template_version: "explain-v1", claims: [] })), "");
  const below60 = recommended([], { value: 42.6, recommended: false });
  assert.equal(panel({ ...below60, explanation: { status: "not_recommended", claims: [] } }), "");
});

test("an unavailable score, loading, an unknown company and a failed request get no card", () => {
  const unavailableScore = panel({
    api_version: "v1", symbol: "ZZOF",
    score: {
      status: "unavailable", reason: "only_fundamentals", value: null, score_version: "score-v1", as_of: STAMP,
      recommended: false, components: [], missing: ["sentiment", "event_exposure"],
    },
    explanation: { status: "unavailable", reason: "score_unavailable", claims: [] },
  });
  for (const html of [
    unavailableScore,
    panel(null),
    panel(null, new api.ScoreApiError("Score API returned 404", 404, "unknown_security")),
    panel(null, new api.ScoreApiError("Score API returned 500", 500, "internal_error")),
  ]) {
    assert.equal(html, "");
  }
});

test("the card is headed \"Why This Company\", with \"Key reasons\" only above claims", () => {
  const heading = (html) => html.match(/id="why-panel-heading"[^>]*>([^<]*)</)[1];
  const withClaims = panel(recommended([claim(1, "Supported by fundamentals.")]));
  assert.equal(heading(withClaims), "Why This Company");
  assert.match(withClaims, /Key reasons/);
  const unexplained = panel(withExplanation({ status: "unavailable", reason: "insufficient_supporting_data", claims: [] }));
  assert.equal(heading(unexplained), "Why This Company");
  assert.doesNotMatch(unexplained, /Key reasons/);
});

// ── the Figma reason cards ───────────────────────────────

test("each reason card has a short title for its measure above the claim", () => {
  const html = panel(recommended([
    claim(1, "Keeps 42 cents of every sales dollar as operating profit."),
    { ...claim(2, "Revenue grew 25% a year over the last 3 years."), measure: "revenue_growth_3y" },
    { ...claim(3, "Social posts leaned positive (4 posts)."), component: "sentiment", measure: "value" },
  ]));
  const titles = [...html.matchAll(/class="why-claim-title">([^<]*)</g)].map((match) => match[1]);
  assert.deepEqual(titles, ["Healthy operating margin", "Strong revenue growth", "Positive sentiment"]);
  assert.match(html, /Key reasons/);
});
