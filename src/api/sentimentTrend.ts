// GET /v1/securities/{symbol}/sentiment/trend (S3-02 AC2): the company's stored sentiment
// reading for each of the last 30 UTC days, null for a day without one (a gap, never zero).
// Contract: the backend's docs/technical-specs/API.md and SENTIMENT_PULSE.md §13.

export type TrendPoint = { date: string; value: number | null };

export type SentimentTrendResponse = {
  api_version: string;
  symbol: string;
  days: number;
  start: string;
  end: string;
  points: TrendPoint[];
};

export class SentimentTrendApiError extends Error {
  status: number | null;
  code: string | null;

  constructor(message: string, status: number | null, code: string | null = null) {
    super(message);
    this.name = "SentimentTrendApiError";
    this.status = status;
    this.code = code;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isPoint(value: unknown): value is TrendPoint {
  return isObject(value)
    && typeof value.date === "string" && DAY.test(value.date)
    && (value.value === null
      || (typeof value.value === "number" && Number.isFinite(value.value) && value.value >= -1 && value.value <= 1));
}

// One point per day, oldest first, from start to end: anything else could put a bar on the
// wrong day, so it is refused rather than shown.
export function isSentimentTrendResponse(value: unknown): value is SentimentTrendResponse {
  if (!isObject(value) || typeof value.symbol !== "string") return false;
  const { days, start, end, points } = value;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1) return false;
  if (typeof start !== "string" || typeof end !== "string" || !DAY.test(start) || !DAY.test(end)) return false;
  if (!Array.isArray(points) || points.length !== days || !points.every(isPoint)) return false;
  const first = Date.parse(`${start}T00:00:00Z`);
  return points.every((point, index) => point.date === new Date(first + index * 86_400_000).toISOString().slice(0, 10))
    && points[points.length - 1].date === end;
}

export async function loadSentimentTrend(symbol: string, signal?: AbortSignal): Promise<SentimentTrendResponse> {
  const baseUrl = import.meta.env.VITE_API_URL?.trim();
  if (!baseUrl) throw new SentimentTrendApiError("Sentiment API is not configured.", null);

  // A cancelled request rejects with fetch's own AbortError, so callers can ignore it.
  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/v1/securities/${encodeURIComponent(symbol)}/sentiment/trend`,
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
    throw new SentimentTrendApiError(`Sentiment trend API returned ${response.status}`, response.status, code);
  }
  if (!isSentimentTrendResponse(payload)) {
    throw new SentimentTrendApiError("Sentiment trend API returned an invalid response.", response.status);
  }
  return payload;
}

export type SentimentTrendState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "empty"; trend: SentimentTrendResponse }
  | { kind: "trend"; trend: SentimentTrendResponse };

export function sentimentTrendState(response: SentimentTrendResponse | null, error?: unknown): SentimentTrendState {
  if (error) return { kind: "error" };
  if (!response) return { kind: "loading" };
  if (response.points.every((point) => point.value === null)) return { kind: "empty", trend: response };
  return { kind: "trend", trend: response };
}
