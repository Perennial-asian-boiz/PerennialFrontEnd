// S3-02 piece 1: the Sentiment Pulse card. The card's view is rendered to static HTML with
// react-dom/server, and its buttons are pressed by walking the element tree (no DOM, no new
// packages). The view has no hooks; SentimentPulse only adds useSentiment and the tab state.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { tsxLoader } from "./render-tsx.mjs";

let loader, View, render, createElement;

before(async () => {
  loader = await tsxLoader();
  ({ SentimentPulseView: View } = await loader.load("src/components/SentimentPulse.tsx"));
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ createElement } = await import("react"));
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
    status: "ok", weighted: false, count: 6,
    first_at: "2026-11-17T23:59:59+00:00", last_at: "2026-11-17T23:59:59+00:00",
    counts: { positive: 2, neutral: 3, negative: 1 },
    shares: { positive: 0.3333, neutral: 0.5, negative: 0.1667 },
  },
};
const reading = (overrides = {}) => ({ kind: "reading", reading: { ...READING, ...overrides } });

function props(state, channel = "news") {
  const pressed = { channels: [], retries: 0 };
  return {
    pressed,
    props: { state, channel, onChannel: (next) => pressed.channels.push(next), onRetry: () => { pressed.retries += 1; } },
  };
}

const html = (state, channel) => render(createElement(View, props(state, channel).props));
const text = (markup) => markup.replace(/<[^>]+>/g, " ").replaceAll("&#x27;", "'").replace(/\s+/g, " ").trim();

// Resolves function components (none of the view's parts use hooks) down to host elements.
function expand(node) {
  if (Array.isArray(node)) return node.flatMap(expand);
  if (!node || typeof node !== "object") return [node];
  if (typeof node.type === "function") return expand(node.type(node.props));
  const children = node.props?.children === undefined ? [] : expand(node.props.children);
  return [{ type: node.type, props: node.props, children }];
}
function find(tree, match) {
  for (const node of tree) {
    if (!node || typeof node !== "object") continue;
    if (match(node)) return node;
    const found = find(node.children, match);
    if (found) return found;
  }
  return null;
}
const label = (node) => node.children.filter((child) => typeof child === "string").join("");
function button(viewProps, name) {
  const tree = expand(createElement(View, viewProps));
  const found = find(tree, (node) => node.type === "button" && label(node) === name);
  assert.ok(found, `no ${name} button`);
  return found;
}

test("News opens with three bars, whole percents, counts, source line and weighting note", () => {
  const markup = html(reading());
  const shown = text(markup);
  assert.match(markup, /<button[^>]*aria-pressed="true"[^>]*>News<\/button>/);
  assert.match(markup, /<button[^>]*aria-pressed="false"[^>]*>Social<\/button>/);
  assert.match(shown, /62% Positive · 8 articles/);
  assert.match(shown, /25% Neutral · 3 articles/);
  assert.match(shown, /13% Negative · 2 articles/);
  assert.match(markup, /width:62%/);
  assert.match(markup, /aria-label="Positive: 62 percent, 8 articles"/);
  assert.match(shown, /Weighted by source credibility and age/);
  assert.match(shown, /Based on 13 articles, Nov 10–17 · tallied Nov 17/);
  assert.ok(markup.indexOf("positive") < markup.indexOf("sentiment-meter neutral"));
  assert.ok(markup.indexOf("sentiment-meter neutral") < markup.indexOf("sentiment-meter negative"));
});

test("Social shows plain shares in posts, with no weighting note", () => {
  const markup = html(reading(), "social");
  const shown = text(markup);
  assert.match(markup, /<button[^>]*aria-pressed="true"[^>]*>Social<\/button>/);
  assert.match(shown, /33% Positive · 2 posts/);
  assert.match(shown, /50% Neutral · 3 posts/);
  assert.match(shown, /17% Negative · 1 post\b/);
  assert.doesNotMatch(shown, /Weighted by/);
  assert.match(shown, /Based on 6 posts collected Nov 17 · tallied Nov 17/);
});

test("the tab buttons only report the chosen tab; both tabs render from the same state", () => {
  const { pressed, props: viewProps } = props(reading());
  button(viewProps, "Social").props.onClick();
  button(viewProps, "News").props.onClick();
  assert.deepEqual(pressed.channels, ["social", "news"]);
  assert.equal(pressed.retries, 0);
});

test("tabs stay clickable while loading, on error and when unavailable", () => {
  for (const state of [{ kind: "loading" }, { kind: "error" }, { kind: "unavailable", reason: "no_reading" }]) {
    const { pressed, props: viewProps } = props(state);
    button(viewProps, "Social").props.onClick();
    assert.deepEqual(pressed.channels, ["social"]);
  }
});

test("one tab can lack coverage while the other shows bars", () => {
  const state = reading({
    social: { status: "not_enough_coverage", weighted: false, count: 1,
      first_at: "2026-11-17T23:59:59+00:00", last_at: "2026-11-17T23:59:59+00:00",
      counts: { positive: 1, neutral: 0, negative: 0 }, shares: null },
  });
  const social = text(html(state, "social"));
  assert.match(social, /Not enough coverage/);
  assert.match(social, /1 of 3 posts needed/);
  assert.doesNotMatch(social, /%/);
  assert.doesNotMatch(social, /Based on/);
  assert.match(text(html(state, "news")), /62% Positive · 8 articles/);
});

test("news below the minimum says Not enough coverage, using the API's minimum", () => {
  const state = reading({
    min_items: 5,
    news: { ...READING.news, status: "not_enough_coverage", count: 4, counts: { positive: 2, neutral: 1, negative: 1 }, shares: null },
  });
  const shown = text(html(state, "news"));
  assert.match(shown, /Not enough coverage/);
  assert.match(shown, /4 of 5 articles needed/);
});

test("unavailable shows the no-data message on both tabs, for either reason", () => {
  for (const reason of ["no_reading", "no_breakdown"]) {
    for (const channel of ["news", "social"]) {
      const shown = text(html({ kind: "unavailable", reason }, channel));
      assert.match(shown, /No sentiment data for this company yet\./);
      assert.doesNotMatch(shown, /%|Based on|Retry/);
    }
  }
});

test("loading shows three skeleton bars and no numbers", () => {
  const markup = html({ kind: "loading" });
  assert.equal(markup.match(/sentiment-loading-track/g)?.length, 3);
  assert.match(markup, /aria-busy="true"/);
  assert.doesNotMatch(text(markup), /%|Based on|No sentiment/);
});

test("an error offers Retry, and Retry asks for exactly one new request", () => {
  const shown = text(html({ kind: "error" }));
  assert.match(shown, /Sentiment couldn't be loaded\./);
  const { pressed, props: viewProps } = props({ kind: "error" });
  button(viewProps, "Retry").props.onClick();
  assert.equal(pressed.retries, 1);
  assert.deepEqual(pressed.channels, []);
});

test("the bars say Neutral, never Mix", () => {
  for (const channel of ["news", "social"]) {
    const markup = html(reading(), channel);
    assert.match(markup, /Neutral/);
    assert.doesNotMatch(markup, /\bMix(ed)?\b/i);
  }
});
