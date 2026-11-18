// GET /v1/securities/{symbol}/price (S3-01): the latest close from a licensed provider.
// Contract: the backend's docs/technical-specs/API.md. Every value is null when unavailable.

export type PriceResponse = {
  api_version: string;
  symbol: string;
  status: "ok" | "unavailable";
  source: string | null;
  as_of: string | null;
  currency: string | null;
  close: number | null;
  previous_close: number | null;
  change: number | null;
  change_percent: number | null;
  high_52w: number | null;
  high_52w_date: string | null;
  low_52w: number | null;
  low_52w_date: string | null;
  stale: boolean;
};

export class PriceApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "PriceApiError";
    this.status = status;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isTextOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

const NUMBERS = ["close", "previous_close", "change", "change_percent", "high_52w", "low_52w"] as const;
const TEXTS = ["source", "as_of", "currency", "high_52w_date", "low_52w_date"] as const;

export function isPriceResponse(value: unknown): value is PriceResponse {
  if (!isObject(value)) return false;
  if (typeof value.api_version !== "string" || typeof value.symbol !== "string") return false;
  if (typeof value.stale !== "boolean") return false;
  if (!NUMBERS.every((key) => isNumberOrNull(value[key])) || !TEXTS.every((key) => isTextOrNull(value[key]))) return false;
  if (value.status === "unavailable") return true;
  // An "ok" body must carry the close, its source and its trading day, so the page never shows a bare number.
  return value.status === "ok" && typeof value.close === "number" && value.close > 0
    && typeof value.source === "string" && typeof value.as_of === "string" && typeof value.currency === "string";
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { response: PriceResponse; cachedAt: number }>();
const pending = new Map<string, Promise<PriceResponse>>();

function waitForRequest<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(new DOMException("The request was aborted.", "AbortError"));

  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(new DOMException("The request was aborted.", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    request.then((result) => {
      signal.removeEventListener("abort", abort);
      resolve(result);
    }, (error: unknown) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
}

export async function loadPrice(symbol: string, signal?: AbortSignal): Promise<PriceResponse> {
  const baseUrl = import.meta.env.VITE_API_URL?.trim();
  if (!baseUrl) throw new PriceApiError("Price API is not configured.", null);

  const normalizedSymbol = symbol.trim().toUpperCase();
  const url = `${baseUrl.replace(/\/$/, "")}/v1/securities/${encodeURIComponent(normalizedSymbol)}/price`;
  if (signal?.aborted) throw new DOMException("The request was aborted.", "AbortError");

  const cached = cache.get(url);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.response;

  let request = pending.get(url);
  if (!request) {
    request = fetch(url).then(async (response) => {
      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        payload = null;
      }
      if (!response.ok) throw new PriceApiError(`Price API returned ${response.status}`, response.status);
      if (!isPriceResponse(payload)) throw new PriceApiError("Price API returned an invalid response.", response.status);
      cache.set(url, { response: payload, cachedAt: Date.now() });
      return payload;
    }).finally(() => pending.delete(url));
    pending.set(url, request);
  }

  return waitForRequest(request, signal);
}
