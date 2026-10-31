// S2-01: the Confidence Score card (AC1: score, version and as-of; AC4: "Score unavailable",
// never an invented number), tested with Node's built-in runner and no new packages.
// The card is rendered to static HTML with react-dom/server. Compiled files go under
// node_modules/.cache so "react" resolves; AppShell is replaced by a ScoreRing stub,
// because the real one loads the router, auth and the dashboard API.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = JSON.stringify({ VITE_API_URL: "http://test.invalid" });
const STUBS = {
  "./AppShell": "export function ScoreRing({ score }) { return `ring:${score}`; }",
};
let outDir;
const compiled = new Map();

async function compile(path) {
  if (compiled.has(path)) return compiled.get(path);
  const target = join(outDir, `${compiled.size}.mjs`);
  compiled.set(path, target);
  const source = (await readFile(path, "utf8")).replaceAll("import.meta.env", `(${env})`);
  let output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      verbatimModuleSyntax: false,
    },
  }).outputText;
  for (const [, spec] of output.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
    let file;
    if (STUBS[spec]) {
      file = join(outDir, `stub-${spec.replace(/\W/g, "")}.mjs`);
      await writeFile(file, STUBS[spec]);
    } else {
      const base = resolve(dirname(path), spec);
      let source = base;
      for (const candidate of [`${base}.ts`, `${base}.tsx`]) {
        if (await exists(candidate)) {
          source = candidate;
          break;
        }
      }
      file = await compile(source);
    }
    output = output.replaceAll(`"${spec}"`, JSON.stringify(pathToFileURL(file).href));
  }
  await writeFile(target, output);
  return target;
}

async function exists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

const load = async (relative) => import(pathToFileURL(await compile(join(root, relative))).href);
let api;
let format;
let ScoreCard;
let render;
let createElement;

before(async () => {
  const cache = join(root, "node_modules", ".cache");
  await mkdir(cache, { recursive: true });
  outDir = await mkdtemp(join(cache, "score-card-test-"));
  api = await load("src/api/score.ts");
  format = await load("src/lib/scoreFormat.ts");
  ScoreCard = (await load("src/components/ScoreCard.tsx")).default;
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ createElement } = await import("react"));
});
after(() => rm(outDir, { recursive: true, force: true }));

const STAMP = "2026-11-05T17:02:11+00:00";

// The contract's two examples (backend #77), trimmed to what the card reads.
const full = {
  api_version: "v1", symbol: "ZZSA",
  score: {
    status: "ok", value: 74.3, score_version: "score-v1", as_of: STAMP, recommended: true,
    components: [], missing: ["event_exposure"],
  },
  explanation: { status: "ok", claims: [] },
};
const unavailable = (reason) => ({
  api_version: "v1", symbol: "ZZSU",
  score: {
    status: "unavailable", reason, value: null, score_version: reason === "not_scored" ? null : "score-v1",
    as_of: reason === "not_scored" ? null : STAMP, recommended: false, components: [],
    missing: ["sentiment", "event_exposure"],
  },
  explanation: { status: "unavailable", reason: "score_unavailable", claims: [] },
});

const card = (response, error) => render(createElement(ScoreCard, { state: api.scoreState(response, error) }));

// ── AC1: the score, its version and its as-of ────────────

test("a scored company shows its score out of 100, its version and its as-of (01-AC1)", () => {
  const html = card(full);
  assert.match(html, /ring:74\.3/);
  assert.match(html, /aria-label="Confidence Score 74\.3 out of 100"/);
  assert.match(html, /score-v1 · as of Nov 5, 2026, 12:02 PM EST/);
  assert.doesNotMatch(html, /Score unavailable/);
});

test("the stamp is the version and the as-of in New York time", () => {
  assert.equal(format.scoreStamp(full.score), "score-v1 · as of Nov 5, 2026, 12:02 PM EST");
  assert.equal(format.scoreStamp({ ...full.score, as_of: null }), "score-v1");
  assert.equal(format.formatAsOf("not a date"), null);
});

test("a score of 0 is shown as 0, not as unavailable", () => {
  const html = card({ ...full, score: { ...full.score, value: 0 } });
  assert.match(html, /ring:0/);
  assert.match(html, /Confidence Score 0\.0 out of 100/);
});

// ── AC4: "Score unavailable", never an invented score ────

for (const [reason, detail] of [
  ["only_fundamentals", "Only fundamentals are available, and a score needs at least one more component."],
  ["no_fundamentals", "Fundamentals aren't available yet, and every score needs them."],
  ["not_scored", "This company hasn't been scored yet."],
  ["something_new", "There isn't enough data to score this company yet."],
]) {
  test(`an unavailable score (${reason}) reads "Score unavailable" with no number (01-AC4)`, () => {
    const html = card(unavailable(reason));
    assert.match(html, /Score unavailable/);
    assert.ok(html.includes(detail.replaceAll("'", "&#x27;")), html);
    assert.doesNotMatch(html, /ring:|out of 100|\d+\.\d/);
  });
}

// ── the other states ─────────────────────────────────────

test("while loading, the card says so and shows no number", () => {
  const html = card(null);
  assert.match(html, /Loading score…/);
  assert.match(html, /aria-busy="true"/);
  assert.doesNotMatch(html, /ring:/);
});

test("an unknown company and a failed request are not shown as a score", () => {
  const notFound = card(null, new api.ScoreApiError("Score API returned 404", 404, "unknown_security"));
  assert.match(notFound, /No score: this company isn(&#x27;|')t in Perennial yet/);
  const failed = card(null, new api.ScoreApiError("Score API returned 500", 500, "internal_error"));
  assert.match(failed, /role="alert"/);
  assert.match(failed, /The score couldn(&#x27;|')t be loaded/);
  for (const html of [notFound, failed]) assert.doesNotMatch(html, /ring:|Score unavailable/);
});
