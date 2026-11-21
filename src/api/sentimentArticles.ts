// GET /v1/securities/{symbol}/sentiment/articles (S3-02 AC3): the 5 news articles with the
// most weight in the company's current sentiment reading, heaviest first.
// Contract: the backend's docs/technical-specs/API.md and SENTIMENT_PULSE.md §14.
import { SENTIMENT_LABELS, type SentimentLabel } from "./sentiment";

export type TopArticle = {
  rank: number;
  headline: string;
  outlet: string;
  url: string;
  published_at: string;
  label: SentimentLabel;
  weight: number;
  share: number;
};

export type SentimentArticlesResponse =
  | { api_version: string; symbol: string; status: "ok"; tallied_on: string; count: number; articles: TopArticle[] }
  | { api_version: string; symbol: string; status: "unavailable"; reason?: string | null };

export class SentimentArticlesApiError extends Error {
  status: number | null;
  code: string | null;

  constructor(message: string, status: number | null, code: string | null = null) {
    super(message);
    this.name = "SentimentArticlesApiError";
    this.status = status;
    this.code = code;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArticle(value: unknown, index: number): value is TopArticle {
  return isObject(value)
    && value.rank === index + 1
    && typeof value.headline === "string" && value.headline.trim() !== ""
    && typeof value.outlet === "string"
    && typeof value.url === "string"
    && typeof value.published_at === "string" && !Number.isNaN(Date.parse(value.published_at))
    && SENTIMENT_LABELS.includes(value.label as SentimentLabel)
    && typeof value.weight === "number" && Number.isFinite(value.weight) && value.weight >= 0
    && typeof value.share === "number" && value.share >= 0 && value.share <= 1;
}

// Enough of the shape to rank and link the articles safely.
export function isSentimentArticlesResponse(value: unknown): value is SentimentArticlesResponse {
  if (!isObject(value) || typeof value.symbol !== "string") return false;
  if (value.status === "unavailable") return true;
  const { articles, count } = value;
  return value.status === "ok"
    && typeof value.tallied_on === "string"
    && typeof count === "number" && Number.isInteger(count) && count >= 0
    && Array.isArray(articles) && articles.length <= 5 && articles.length <= count
    && articles.every(isArticle);
}

// Only an http(s) link is rendered as a link; anything else (javascript:, data:, a typo)
// leaves the headline as plain text.
export function safeArticleUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

export async function loadSentimentArticles(symbol: string, signal?: AbortSignal): Promise<SentimentArticlesResponse> {
  const baseUrl = import.meta.env.VITE_API_URL?.trim();
  if (!baseUrl) throw new SentimentArticlesApiError("Sentiment API is not configured.", null);

  // A cancelled request rejects with fetch's own AbortError, so callers can ignore it.
  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/v1/securities/${encodeURIComponent(symbol)}/sentiment/articles`,
    { signal },
  );
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") throw caught;
  }
  if (!response.ok) {
    const code = isObject(payload) && typeof payload.code === "string" ? payload.code : null;
    throw new SentimentArticlesApiError(`Sentiment articles API returned ${response.status}`, response.status, code);
  }
  if (!isSentimentArticlesResponse(payload)) {
    throw new SentimentArticlesApiError("Sentiment articles API returned an invalid response.", response.status);
  }
  return payload;
}

export type SentimentArticlesState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "none" } // unavailable, or no articles counted: the section is hidden
  | { kind: "articles"; count: number; articles: TopArticle[] };

export function sentimentArticlesState(response: SentimentArticlesResponse | null, error?: unknown): SentimentArticlesState {
  if (error) return { kind: "error" };
  if (!response) return { kind: "loading" };
  if (response.status === "unavailable" || response.articles.length === 0) return { kind: "none" };
  return { kind: "articles", count: response.count, articles: response.articles };
}
