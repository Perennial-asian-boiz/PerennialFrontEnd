import { dashboardPayload, type DashboardBucket, type DashboardPayload } from "../dashboardData";
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
 * Loads the backend dashboard data when VITE_API_URL is configured.
 * Without an API URL, the local fixture remains the development fallback.
 */
export async function loadDashboardPayload(signal?: AbortSignal): Promise<DashboardPayload> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return dashboardPayload;

  const response = await fetch(apiUrl, { signal });
  if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);

  const payload = await response.json() as DashboardApiResponse;
  return toDashboardPayload(payload);
}

export const dashboardBuckets: DashboardBucket[] = ["affordable_growing", "popular_stable"];
