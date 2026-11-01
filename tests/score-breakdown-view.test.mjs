// S2-02 in the Figma "Score Breakdown" layout: one bar per component with its value, weight
// and contribution (AC1), the sum against the score (AC2), as-of and version on tap (AC3),
// and a missing component labelled Unavailable (AC4). Rendered with react-dom/server.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { tsxLoader } from "./render-tsx.mjs";

let loader;
let api;
let ScoreBreakdown;
let render;
let createElement;

before(async () => {
  loader = await tsxLoader();
  api = await loader.load("src/api/score.ts");
  ScoreBreakdown = (await loader.load("src/components/ScoreBreakdown.tsx")).default;
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ createElement } = await import("react"));
});
after(() => loader.cleanup());

const STAMP = "2026-11-05T17:02:11+00:00";
const scored = {
  api_version: "v1", symbol: "ZZSA",
  score: {
    status: "ok", value: 74.3, score_version: "score-v1", as_of: STAMP, recommended: true,
    components: [
      { name: "fundamentals", status: "ok", value: 78, nominal_weight: 0.6, weight: 0.7059, contribution: 55.06,
        input_as_of: "2025-06-30", input_version: "fundamentals-v1", record: { table: "fundamental_scores", id: 812 } },
      { name: "sentiment", status: "ok", value: 65.5, nominal_weight: 0.25, weight: 0.2941, contribution: 19.26,
        input_as_of: "2026-11-04", input_version: "weights-v1", record: { table: "ticker_sentiment", id: 77 } },
      { name: "event_exposure", status: "unavailable", value: null, nominal_weight: 0.15, weight: 0, contribution: 0,
        input_as_of: null, input_version: null, record: null },
    ],
    missing: ["event_exposure"],
  },
  explanation: { status: "ok", claims: [] },
};
const view = (response, error) => render(createElement(ScoreBreakdown, { state: api.scoreState(response, error) }));

test("each present factor shows its band and value, and on tap its weight and contribution (02-AC1)", () => {
  const html = view(scored);
  assert.match(html, /Fundamentals<\/span><span class="factor-pill">Strong \(78\.0\)/);
  assert.match(html, /News sentiment<\/span><span class="factor-pill">Mix \(65\.5\)/);
  assert.match(html, /<dt>Weight<\/dt><dd>70\.59% <span class="factor-nominal">\(nominal 60\.00%\)<\/span><\/dd><dt>Contribution<\/dt><dd>55\.06 points/);
  assert.match(html, /<dt>Weight<\/dt><dd>29\.41% .*?<dt>Contribution<\/dt><dd>19\.26 points/);
  assert.match(html, /style="width:78%"/);
  assert.match(html, /Factors \(2 Active\)/);
  assert.match(html, /Tap any factor to inspect fundamental quantitative weights/);
});

test("the footer adds the contributions up against the score (02-AC2)", () => {
  assert.match(view(scored), /Contributions add up to 74\.32 · Score 74\.3 \(contributions are rounded to 0\.01\)/);
});

test("a factor's details show its input as-of and version (02-AC3)", () => {
  const html = view(scored);
  assert.match(html, /<dt>Input as of<\/dt><dd>2025-06-30<\/dd><dt>Version<\/dt><dd>fundamentals-v1<\/dd>/);
  assert.match(html, /score-v1 · as of Nov 5, 2026, 12:02 PM EST/);
});

test("a missing factor reads Unavailable, weight redistributed, with an empty bar (02-AC4)", () => {
  const html = view(scored);
  assert.match(html, /Event exposure<\/span><span class="factor-pill">Unavailable/);
  assert.match(html, /Unavailable — weight redistributed to the other components/);
  assert.match(html, /<span class="factor-bar" aria-hidden="true"><\/span>/);
});

test("with no factors to draw (an unavailable score, loading, errors) there's no card", () => {
  const unavailable = view({ ...scored, score: { ...scored.score, status: "unavailable", reason: "not_scored", value: null, components: [] } });
  for (const html of [unavailable, view(null), view(null, new api.ScoreApiError("Score API returned 500", 500))]) {
    assert.equal(html, "");
  }
});

test("a factor's details leave out an as-of or version that isn't stored", () => {
  const bare = { ...scored.score.components[0], input_as_of: null, input_version: null };
  const html = view({ ...scored, score: { ...scored.score, components: [bare, ...scored.score.components.slice(1)] } });
  const details = html.match(/<dl class="factor-details">(.*?)<\/dl>/)[1];
  assert.doesNotMatch(details, /Input as of|Version|—/);
  assert.match(details, /Weight.*Contribution/);
});
