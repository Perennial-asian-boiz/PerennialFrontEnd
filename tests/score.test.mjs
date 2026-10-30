// S2-02 (FE-6): the score client (FE-1), the breakdown rows (FE-3) and the page states (FE-5),
// tested with Node's built-in runner and no new packages, as auth.test.mjs does.
// Contract: GET /v1/securities/{symbol}/score, backend API.md at f68da3b (comment on backend #77).
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = JSON.stringify({ VITE_API_URL: "http://test.invalid" });
let outDir;
const compiled = new Map();

// Transpile a source file, and any relative imports it makes, into a temp directory.
async function compile(path) {
  if (compiled.has(path)) return compiled.get(path);
  const target = join(outDir, `${compiled.size}.mjs`);
  compiled.set(path, target);
  const source = (await readFile(path, "utf8")).replaceAll("import.meta.env", `(${env})`);
  let output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: false },
  }).outputText;
  for (const [, spec] of output.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
    const base = resolve(dirname(path), spec);
    const file = [base, `${base}.ts`].find((candidate) => /\.ts$/.test(candidate));
    output = output.replaceAll(`"${spec}"`, JSON.stringify(pathToFileURL(await compile(file)).href));
  }
  await writeFile(target, output);
  return target;
}

const load = async (relative) => import(pathToFileURL(await compile(join(root, relative))).href);
let api;
let breakdown;

before(async () => {
  outDir = await mkdtemp(join(tmpdir(), "score-test-"));
  api = await load("src/api/score.ts");
  breakdown = await load("src/lib/scoreBreakdown.ts");
});
after(() => rm(outDir, { recursive: true, force: true }));

const MISSING_TEXT = "Unavailable — weight redistributed to the other components";
const STAMP = "2026-11-05T17:02:11+00:00";

// The two examples from the contract, verbatim.
const full = {
  api_version: "v1", symbol: "ZZSA",
  score: {
    status: "ok", value: 74.3, score_version: "score-v1", as_of: STAMP, recommended: true,
    components: [
      { name: "fundamentals", status: "ok", value: 78.0, nominal_weight: 0.6, weight: 0.7059, contribution: 55.06,
        input_as_of: "2025-06-30", input_version: "fundamentals-v1", record: { table: "fundamental_scores", id: 812 } },
      { name: "sentiment", status: "ok", value: 65.5, nominal_weight: 0.25, weight: 0.2941, contribution: 19.26,
        input_as_of: "2026-11-04", input_version: "sentiment-rollup-v1", record: { table: "ticker_sentiment", id: 77 } },
      { name: "event_exposure", status: "unavailable", value: null, nominal_weight: 0.15, weight: 0.0, contribution: 0.0,
        input_as_of: null, input_version: null, record: null, note: "weight redistributed to the remaining components" },
    ],
    missing: ["event_exposure"],
  },
  explanation: {
    status: "ok", template_version: "explain-v1", as_of: STAMP,
    claims: [
      { order: 1, text: "Keeps 42 cents of every sales dollar as operating profit.", component: "fundamentals",
        measure: "operating_margin", record: { table: "fundamental_scores", id: 812, batch_id: 5 },
        as_of: "2025-06-30", value: "0.420000" },
      { order: 2, text: "Revenue grew 18% a year over the last 3 years.", component: "fundamentals",
        measure: "revenue_growth_3y", record: { table: "fundamental_scores", id: 812, batch_id: 5 },
        as_of: "2025-06-30", value: "0.180000" },
      { order: 3, text: "News coverage over the last 7 days leaned positive (12 articles).", component: "sentiment",
        measure: "value", record: { table: "ticker_sentiment", id: 77, batch_id: 9 },
        as_of: "2026-11-04", value: "0.3100" },
    ],
  },
};

const unavailable = {
  api_version: "v1", symbol: "ZZSU",
  score: { status: "unavailable", reason: "only_fundamentals", value: null, score_version: "score-v1", as_of: STAMP,
    recommended: false, components: [], missing: ["sentiment", "event_exposure"] },
  explanation: { status: "unavailable", reason: "score_unavailable", template_version: "explain-v1", as_of: STAMP,
    claims: [] },
};

const notScored = {
  api_version: "v1", symbol: "ZZNS",
  score: { status: "unavailable", reason: "not_scored", value: null, score_version: null, as_of: null,
    recommended: false, components: [], missing: [] },
  explanation: { status: "unavailable", reason: "not_scored", claims: [] },
};

const noFundamentals = {
  api_version: "v1", symbol: "ZZNF",
  score: { status: "unavailable", reason: "no_fundamentals", value: null, score_version: "score-v1", as_of: STAMP,
    recommended: false, components: [], missing: ["fundamentals", "event_exposure"] },
  explanation: { status: "unavailable", reason: "score_unavailable", template_version: "explain-v1", as_of: STAMP,
    claims: [] },
};

const clone = (value) => structuredClone(value);
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const serve = (respond) => {
  globalThis.fetch = respond;
};
async function failure(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail("expected the request to fail");
}

// A full score whose two present contributions are replaced, for the footer-sum boundaries.
function withContributions(value, fundamentals, sentiment) {
  const body = clone(full);
  body.score.value = value;
  body.score.components[0].contribution = fundamentals;
  body.score.components[1].contribution = sentiment;
  return body.score;
}

// ---------------------------------------------------------------- FE-1: types

test("the exported types accept the contract's bodies and refuse wrong shapes", () => {
  const virtual = join(root, "tests", "__score_contract__.ts");
  const literal = (value) => JSON.stringify(value);
  const okScore = '{ "status": "ok", "value": 74.3, "score_version": "score-v1", "as_of": null, "recommended": true, "components": [], "missing": [] }';
  const source = `import type { Claim, Explanation, Score, ScoreComponent, ScoreResponse } from "../src/api/score";
export const full: ScoreResponse = ${literal(full)};
export const unavailable: ScoreResponse = ${literal(unavailable)};
export const notScored: ScoreResponse = ${literal(notScored)};
export const noFundamentals: ScoreResponse = ${literal(noFundamentals)};
export const notRecommended: Explanation = { status: "not_recommended", template_version: "explain-v1", as_of: "${STAMP}", claims: [] };
export const insufficient: Explanation = { status: "unavailable", reason: "insufficient_supporting_data", template_version: "explain-v1", as_of: "${STAMP}", claims: [] };
export const notExplainedYet: Explanation = { status: "unavailable", reason: "not_explained_yet", claims: [] };
export const component: ScoreComponent = ${literal(full.score.components[0])};
export const claim: Claim = ${literal(full.explanation.claims[0])};
export const score: Score = ${okScore};
// @ts-expect-error a score's value is a JSON number, never a string
export const stringValue: Score = { ...score, value: "74.3" };
// @ts-expect-error a score's status is ok or unavailable
export const otherStatus: Score = { ...score, status: "partial" };
// @ts-expect-error an explanation's status is ok, not_recommended or unavailable
export const otherExplanation: Explanation = { status: "recommended", claims: [] };
// @ts-expect-error a component always has its contribution
export const noContribution: ScoreComponent = { name: "sentiment", status: "ok", value: 65.5, nominal_weight: 0.25, weight: 0.2941, input_as_of: "2026-11-04", input_version: "sentiment-rollup-v1", record: { table: "ticker_sentiment", id: 77 } };
// @ts-expect-error a claim's record carries its batch_id
export const noBatch: Claim = { ...claim, record: { table: "fundamental_scores", id: 812 } };
`;
  const configPath = join(root, "tsconfig.app.json");
  const config = ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, root);
  const options = { ...config.options, noEmit: true, incremental: false, tsBuildInfoFile: undefined };
  const host = ts.createCompilerHost(options);
  const { getSourceFile, fileExists, readFile: hostRead } = host;
  host.getSourceFile = (name, ...rest) =>
    name === virtual ? ts.createSourceFile(name, source, ts.ScriptTarget.ES2022, true) : getSourceFile(name, ...rest);
  host.fileExists = (name) => name === virtual || fileExists(name);
  host.readFile = (name) => (name === virtual ? source : hostRead(name));
  const program = ts.createProgram([virtual], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(
    ts.formatDiagnostics(diagnostics, { getCanonicalFileName: (f) => f, getCurrentDirectory: () => root, getNewLine: () => "\n" }),
    "",
  );
});

// ---------------------------------------------------------------- FE-1: the client

test("the client requests the score route and returns a full score as served", async () => {
  const controller = new AbortController();
  serve(async (url, init) => {
    assert.equal(url, "http://test.invalid/v1/securities/ZZSA/score");
    assert.equal(init?.signal, controller.signal);
    return reply(full);
  });
  assert.deepEqual(await api.loadScore("ZZSA", controller.signal), full);
});

test("the client encodes the symbol into the path", async () => {
  let requested;
  serve(async (url) => {
    requested = url;
    return reply({ ...clone(full), symbol: "BRK.B" });
  });
  await api.loadScore("BRK B");
  assert.equal(requested, "http://test.invalid/v1/securities/BRK%20B/score");
});

for (const body of [unavailable, notScored, noFundamentals]) {
  test(`a 200 with an unavailable score (${body.score.reason}) resolves; it isn't an error`, async () => {
    serve(async () => reply(body));
    assert.deepEqual(await api.loadScore(body.symbol), body);
  });
}

test("a 404 is a ScoreApiError with status 404 and code unknown_security", async () => {
  serve(async () => reply({ detail: "no security has that ticker", code: "unknown_security" }, 404));
  const error = await failure(api.loadScore("ZZXX"));
  assert.ok(error instanceof api.ScoreApiError);
  assert.equal(error.status, 404);
  assert.equal(error.code, "unknown_security");
});

test("a 500 is a ScoreApiError, with the code from a JSON body or without one", async () => {
  serve(async () => reply({ detail: "request failed", code: "internal_error" }, 500));
  const json = await failure(api.loadScore("ZZSA"));
  assert.ok(json instanceof api.ScoreApiError);
  assert.equal(json.status, 500);
  assert.equal(json.code, "internal_error");

  serve(async () => new Response("Internal Server Error", { status: 500, headers: { "Content-Type": "text/plain" } }));
  const plain = await failure(api.loadScore("ZZSA"));
  assert.ok(plain instanceof api.ScoreApiError);
  assert.equal(plain.status, 500);
});

for (const [name, respond] of [
  ["not JSON", () => new Response("<html>gateway</html>", { status: 200, headers: { "Content-Type": "text/html" } })],
  ["an empty object", () => reply({})],
  ["the security route's body", () => reply({ security: { symbol: "ZZSA", name: null, sector: null, summary: null } })],
  ["a score without an explanation", () => reply({ api_version: "v1", symbol: "ZZSA", score: full.score })],
]) {
  test(`a 200 whose body is ${name} is refused, not shown as a score`, async () => {
    serve(async () => respond());
    const error = await failure(api.loadScore("ZZSA"));
    assert.equal(api.scoreState(null, error).kind, "error");
  });
}

test("a cancelled request rejects with the AbortError itself, so a page can ignore it", async () => {
  const controller = new AbortController();
  serve(async (_url, init) => {
    controller.abort();
    init.signal.throwIfAborted();
    return reply(full);
  });
  const error = await failure(api.loadScore("ZZSA", controller.signal));
  assert.equal(error.name, "AbortError");
});

// ---------------------------------------------------------------- FE-5: the states

test("before a response or an error, the state is loading", () => {
  assert.deepEqual(api.scoreState(null, null), { kind: "loading" });
  assert.equal(api.scoreState(null).kind, "loading");
});

test("a full score is the scored state, with the score as served", () => {
  const state = api.scoreState(clone(full), null);
  assert.equal(state.kind, "scored");
  assert.deepEqual(state.score, full.score);
});

for (const body of [notScored, unavailable, noFundamentals]) {
  test(`a 200 unavailable score (${body.score.reason}) reads "Score unavailable", not an error or a 404`, async () => {
    serve(async () => reply(body));
    const state = api.scoreState(await api.loadScore(body.symbol), null);
    assert.equal(state.kind, "unavailable");
    assert.equal(state.reason, body.score.reason);
    assert.equal(state.label, "Score unavailable");
    assert.equal(state.score, undefined);
  });
}

test("a 404 is the not-found state, distinct from an unavailable score", async () => {
  serve(async () => reply({ detail: "no security has that ticker", code: "unknown_security" }, 404));
  const state = api.scoreState(null, await failure(api.loadScore("ZZXX")));
  assert.equal(state.kind, "not_found");
  assert.notEqual(state.label, "Score unavailable");
});

for (const [name, respond] of [
  ["a network failure", () => Promise.reject(new TypeError("Failed to fetch"))],
  ["a 500 internal_error", () => reply({ detail: "request failed", code: "internal_error" }, 500)],
  ["a 503 without JSON", () => new Response("upstream down", { status: 503 })],
]) {
  test(`${name} is the error state, not "Score unavailable"`, async () => {
    serve(async () => respond());
    const state = api.scoreState(null, await failure(api.loadScore("ZZSA")));
    assert.equal(state.kind, "error");
    assert.notEqual(state.label, "Score unavailable");
    assert.equal(state.reason, undefined);
  });
}

// ---------------------------------------------------------------- FE-3: the breakdown rows

const ROW_KEYS = ["name", "status", "value", "weight", "nominalWeight", "contribution", "inputAsOf", "version", "note"];
const pick = (row) => Object.fromEntries(ROW_KEYS.map((key) => [key, row[key]]));

test("the breakdown has a row per component, in the served order (02-AC1)", () => {
  const rows = breakdown.breakdownRows(clone(full.score));
  assert.deepEqual(rows.map((row) => row.name), ["fundamentals", "sentiment", "event_exposure"]);
  assert.match(rows[0].label, /fundamental/i);
  assert.match(rows[1].label, /sentiment/i);
  assert.match(rows[2].label, /event/i);
});

test("a present component shows its value, effective weight, nominal weight, contribution, as-of and version (02-AC1/AC3)", () => {
  const [fundamentals, sentiment] = breakdown.breakdownRows(clone(full.score));
  assert.deepEqual(pick(fundamentals), {
    name: "fundamentals", status: "ok", value: 78.0, weight: 0.7059, nominalWeight: 0.6, contribution: 55.06,
    inputAsOf: "2025-06-30", version: "fundamentals-v1", note: null,
  });
  assert.deepEqual(pick(sentiment), {
    name: "sentiment", status: "ok", value: 65.5, weight: 0.2941, nominalWeight: 0.25, contribution: 19.26,
    inputAsOf: "2026-11-04", version: "sentiment-rollup-v1", note: null,
  });
});

test(`a missing component reads "${MISSING_TEXT}" (02-AC4)`, () => {
  const event = breakdown.breakdownRows(clone(full.score))[2];
  assert.equal(event.status, "unavailable");
  assert.equal(event.note, MISSING_TEXT);
  assert.equal(event.value, null);
  assert.equal(event.nominalWeight, 0.15);
  assert.equal(event.inputAsOf, null);
  assert.equal(event.version, null);
});

test("an unavailable score has no breakdown rows and no total, rather than invented numbers", () => {
  for (const body of [unavailable, notScored, noFundamentals]) {
    assert.deepEqual(breakdown.breakdownRows(clone(body.score)), []);
    assert.equal(breakdown.contributionTotal(clone(body.score)), null);
  }
});

// ---------------------------------------------------------------- FE-3: the footer sum (02-AC2)

test("the footer adds the contributions and agrees with the served score", () => {
  const total = breakdown.contributionTotal(clone(full.score));
  assert.ok(Math.abs(total.total - 74.32) < 1e-9, `total ${total.total}`);
  assert.equal(total.consistent, true);
});

for (const [value, fundamentals, sentiment, consistent] of [
  [70.0, 50.25, 20.25, true], // +0.5: inside the tolerance
  [70.0, 49.25, 20.25, true], // -0.5
  [70.0, 50.25, 20.5, false], // +0.75
  [70.0, 49.25, 20.0, false], // -0.75
]) {
  test(`contributions ${fundamentals} + ${sentiment} against a score of ${value}: consistent is ${consistent}`, () => {
    const total = breakdown.contributionTotal(withContributions(value, fundamentals, sentiment));
    assert.ok(Math.abs(total.total - (fundamentals + sentiment)) < 1e-9, `total ${total.total}`);
    assert.equal(total.consistent, consistent);
  });
}
