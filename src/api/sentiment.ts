// GET /v1/securities/{symbol}/sentiment (S3-02 piece 1): the Sentiment Pulse breakdown, the
// share of positive, neutral and negative items behind a company's newest sentiment reading.
// Contract: the backend's docs/technical-specs/API.md and SENTIMENT_PULSE.md §6.1.

export const SENTIMENT_LABELS = ["positive", "neutral", "negative"] as const;
export type SentimentLabel = (typeof SENTIMENT_LABELS)[number];
export type SentimentChannelName = "news" | "social";

export type LabelCounts = Record<SentimentLabel, number>;
export type LabelShares = Record<SentimentLabel, number>;

export type SentimentChannel = {
  status: "ok" | "not_enough_coverage";
  weighted: boolean;
  count: number;
  first_at: string | null;
  last_at: string | null;
  counts: LabelCounts;
  shares: LabelShares | null;
};

export type SentimentReading = {
  api_version: string;
  symbol: string;
  status: "ok";
  tallied_on: string;
  min_items: number;
  news: SentimentChannel;
  social: SentimentChannel;
};

export type SentimentUnavailable = {
  api_version: string;
  symbol: string;
  status: "unavailable";
  reason?: string | null;
};

export type SentimentResponse = SentimentReading | SentimentUnavailable;

export class SentimentApiError extends Error {
  status: number | null;
  code: string | null;

  constructor(message: string, status: number | null, code: string | null = null) {
    super(message);
    this.name = "SentimentApiError";
    this.status = status;
    this.code = code;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isShare(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isDate(value: unknown): boolean {
  return value === null || (typeof value === "string" && !Number.isNaN(new Date(value).getTime()));
}

function isChannel(value: unknown): value is SentimentChannel {
  if (!isObject(value) || !isObject(value.counts) || !isCount(value.count)) return false;
  const { counts, shares, status } = value;
  if (!SENTIMENT_LABELS.every((label) => isCount(counts[label]))) return false;
  if (SENTIMENT_LABELS.reduce((sum, label) => sum + (counts[label] as number), 0) !== value.count) return false;
  if (typeof value.weighted !== "boolean" || !isDate(value.first_at) || !isDate(value.last_at)) return false;
  if (status === "ok") return isObject(shares) && SENTIMENT_LABELS.every((label) => isShare(shares[label]));
  return status === "not_enough_coverage" && shares === null;
}

// Enough of the shape to know it's a sentiment body, not another route's or a proxy's page.
export function isSentimentResponse(value: unknown): value is SentimentResponse {
  if (!isObject(value) || typeof value.symbol !== "string") return false;
  if (value.status === "unavailable") return true;
  return value.status === "ok"
    && typeof value.tallied_on === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value.tallied_on)
    && isCount(value.min_items)
    && isChannel(value.news)
    && isChannel(value.social);
}

export async function loadSentiment(symbol: string, signal?: AbortSignal): Promise<SentimentResponse> {
  const baseUrl = import.meta.env.VITE_API_URL?.trim();
  if (!baseUrl) throw new SentimentApiError("Sentiment API is not configured.", null);

  // A cancelled request rejects with fetch's own AbortError, so callers can ignore it.
  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/v1/securities/${encodeURIComponent(symbol)}/sentiment`,
    { signal },
  );
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch (caught) {
    // Not JSON: payload stays null, and it's refused below.
    if (caught instanceof DOMException && caught.name === "AbortError") throw caught;
  }
  if (!response.ok) {
    const code = isObject(payload) && typeof payload.code === "string" ? payload.code : null;
    throw new SentimentApiError(`Sentiment API returned ${response.status}`, response.status, code);
  }
  if (!isSentimentResponse(payload)) {
    throw new SentimentApiError("Sentiment API returned an invalid response.", response.status);
  }
  return payload;
}

export type SentimentState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "unavailable"; reason: string | null }
  | { kind: "reading"; reading: SentimentReading };

// Every failure, a 404 included, is an error: the page handles unknown companies before the
// card mounts, so the card only offers Retry.
export function sentimentState(response: SentimentResponse | null, error?: unknown): SentimentState {
  if (error) return { kind: "error" };
  if (!response) return { kind: "loading" };
  if (response.status === "unavailable") return { kind: "unavailable", reason: response.reason ?? null };
  return { kind: "reading", reading: response };
}
