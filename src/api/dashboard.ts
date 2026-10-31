import { emptyDashboardPayload, type DashboardBucket, type DashboardPayload } from "../dashboardData";
import type { Company } from "../data";

/**
 * Display-ready response expected from the backend API.
 *
 * The current backend consensus file is an internal pipeline artifact. It has
 * ticker, bucket, and raw signals, but not enough display metadata for the
 * dashboard. The API should return this smaller, UI-facing contract instead.
 */
export type DashboardApiCompany = {
  name: string;
  ticker: string;
  sector: string;
  price: number | null;
  change_percent: number | null;
  confidence_score: number | null;
  sentiment: Company["sentiment"];
  reason: string | null;
};

export type DashboardApiResponse = {
  schema_version: string;
  generated_at: string;
  affordable_growing: DashboardApiCompany[];
  popular_stable: DashboardApiCompany[];
};

const DASHBOARD_CACHE_TTL_MS = 30_000;
const dashboardCache = new Map<string, { payload: DashboardPayload; cachedAt: number }>();
const pendingDashboardRequests = new Map<string, Promise<DashboardPayload>>();

function formatPrice(value: number | null) {
  return value === null ? "—" : `$${value.toFixed(2)}`;
}

function formatChange(value: number | null) {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function toCompany(record: DashboardApiCompany): Company {
  return {
    name: record.name,
    ticker: record.ticker,
    sector: record.sector,
    price: formatPrice(record.price),
    score: record.confidence_score ?? 0,
    change: formatChange(record.change_percent),
    sentiment: record.sentiment,
    reason: record.reason ?? "No additional context is available yet.",
  };
}

function toDashboardPayload(response: DashboardApiResponse): DashboardPayload {
  return {
    affordable_growing: response.affordable_growing.map(toCompany),
    popular_stable: response.popular_stable.map(toCompany),
  };
}

function getApiUrl() {
  const baseUrl = import.meta.env.VITE_API_URL?.trim();
  return baseUrl ? `${baseUrl.replace(/\/$/, "")}/api/watchlist` : null;
}

/**
 * Loads backend dashboard data when VITE_API_URL is configured. With no API
 * URL, return empty buckets so the UI can show placeholders instead of sample
 * market data that might be mistaken for live data.
 */
export async function loadDashboardPayload(signal?: AbortSignal): Promise<DashboardPayload> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return emptyDashboardPayload;

  if (signal?.aborted) throw new DOMException("The request was aborted.", "AbortError");

  const cached = dashboardCache.get(apiUrl);
  if (cached && Date.now() - cached.cachedAt < DASHBOARD_CACHE_TTL_MS) return cached.payload;

  let request = pendingDashboardRequests.get(apiUrl);
  if (!request) {
    request = fetch(apiUrl).then(async (response) => {
      if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
      const payload = toDashboardPayload(await response.json() as DashboardApiResponse);
      dashboardCache.set(apiUrl, { payload, cachedAt: Date.now() });
      return payload;
    }).finally(() => pendingDashboardRequests.delete(apiUrl));
    pendingDashboardRequests.set(apiUrl, request);
  }

  if (!signal) return request;
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(new DOMException("The request was aborted.", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    request!.then((payload) => {
      signal.removeEventListener("abort", abort);
      resolve(payload);
    }, (error: unknown) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
}

export const dashboardBuckets: DashboardBucket[] = ["affordable_growing", "popular_stable"];
