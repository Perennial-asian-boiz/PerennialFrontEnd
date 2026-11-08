import type { Company } from "../data";
import type { DashboardBucket } from "../dashboardData";
import { loadSecurityDetails } from "./company";
import { loadDashboardPayload } from "./dashboard";

export type ArkSignal = {
  fundCount: number;
  totalWeight: number | null;
  funds: string[];
};

export type InsiderSignal = {
  buyCount: number;
  insiderCount: number | null;
};

export type PublishedDashboardCompany = Company & {
  rank: number;
  arkSignal: ArkSignal | null;
  insiderSignal: InsiderSignal | null;
};

export type PublishedDashboardPayload = Record<DashboardBucket, PublishedDashboardCompany[]>;

export const emptyPublishedDashboardPayload: PublishedDashboardPayload = {
  affordable_growing: [],
  popular_stable: [],
};

type PublishedEntry = {
  ticker: string;
  rank: number;
  arkSignal: ArkSignal | null;
  insiderSignal: InsiderSignal | null;
};

const buckets: DashboardBucket[] = ["affordable_growing", "popular_stable"];
const cache = new Map<string, { data: PublishedDashboardPayload; at: number }>();
const pending = new Map<string, Promise<PublishedDashboardPayload>>();
const CACHE_TTL_MS = 30_000;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidResponse(): never {
  throw new Error("The published watchlist response is invalid.");
}

function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) invalidResponse();
  return value;
}

function arkSignal(value: unknown): ArkSignal | null {
  if (value == null) return null;
  if (!object(value)) invalidResponse();
  const weight = value.total_weight;
  if (weight != null && (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0)) invalidResponse();
  if (value.funds != null && (!Array.isArray(value.funds) || !value.funds.every((fund) => typeof fund === "string"))) invalidResponse();
  return {
    fundCount: count(value.fund_count),
    totalWeight: weight == null ? null : weight as number,
    funds: (value.funds ?? []) as string[],
  };
}

function insiderSignal(value: unknown): InsiderSignal | null {
  if (value == null) return null;
  if (!object(value)) invalidResponse();
  return {
    buyCount: count(value.buy_count),
    insiderCount: value.distinct_insider_count == null ? null : count(value.distinct_insider_count),
  };
}

function parsePublication(value: unknown): Record<DashboardBucket, PublishedEntry[]> {
  if (!object(value) || value.api_version !== "v1" || !object(value.publication)
    || typeof value.publication.id !== "number" || !object(value.watchlist)) invalidResponse();
  const result: Record<DashboardBucket, PublishedEntry[]> = { affordable_growing: [], popular_stable: [] };
  for (const bucket of buckets) {
    const records = value.watchlist[bucket];
    if (!Array.isArray(records)) invalidResponse();
    const seen = new Set<string>();
    result[bucket] = records.map((record: unknown) => {
      if (!object(record) || typeof record.ticker !== "string" || !record.ticker.trim()
        || !object(record.signals)) invalidResponse();
      const ticker = record.ticker.trim().toUpperCase();
      const rank = count(record.rank);
      if (rank === 0 || seen.has(ticker)) invalidResponse();
      seen.add(ticker);
      return { ticker, rank, arkSignal: arkSignal(record.signals.ark), insiderSignal: insiderSignal(record.signals.insider) };
    }).sort((a, b) => a.rank - b.rank);
  }
  return result;
}

function sectorLabel(value: string | null): string {
  const sector = value?.trim() || "Unclassified";
  const aliases: Record<string, string> = {
    "Information Technology": "Technology", "Health Care": "Healthcare",
    "Financial Services": "Financials", "Consumer Cyclical": "Consumer Discretionary",
    "Consumer Defensive": "Consumer Staples", "Basic Materials": "Materials",
  };
  return aliases[sector] ?? sector;
}

async function fetchDashboard(url: string): Promise<PublishedDashboardPayload> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(response.status === 404
    ? "No watchlist publication is available yet."
    : `Published watchlist API returned ${response.status}.`);
  const entries = parsePublication(await response.json());

  // Rank and signals always come from /v1/watchlist. The existing display
  // adapter provides names/sectors in one shared, cached request.
  const display = await loadDashboardPayload();
  const metadata = new Map([...display.affordable_growing, ...display.popular_stable]
    .map((company) => [company.ticker.toUpperCase(), company]));

  // A publication can change between the two requests. Resolve just the new
  // tickers, with bounded concurrency, rather than dropping those companies.
  const missing = [...new Set(buckets.flatMap((bucket) => entries[bucket].map((entry) => entry.ticker)))]
    .filter((ticker) => !metadata.has(ticker));
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, missing.length) }, async () => {
    while (next < missing.length) {
      const ticker = missing[next++];
      try {
        const security = await loadSecurityDetails(ticker);
        metadata.set(ticker, {
          name: security.name || ticker, ticker, sector: sectorLabel(security.sector),
          price: "—", change: "—", score: 0, sentiment: "Neutral", reason: "Published pipeline data.",
        });
      } catch {
        // Missing display metadata cannot manufacture an industry or signal.
      }
    }
  }));

  const result: PublishedDashboardPayload = { affordable_growing: [], popular_stable: [] };
  for (const bucket of buckets) {
    result[bucket] = entries[bucket].map((entry) => ({
      name: entry.ticker, ticker: entry.ticker, sector: "Unclassified",
      score: 0, sentiment: "Neutral", reason: "Published pipeline data.",
      ...metadata.get(entry.ticker),
      // No price or price change is provided by the published contract.
      price: "—", change: "—", rank: entry.rank,
      arkSignal: entry.arkSignal, insiderSignal: entry.insiderSignal,
    }));
  }
  return result;
}

export function loadPublishedDashboardPayload(signal?: AbortSignal): Promise<PublishedDashboardPayload> {
  if (signal?.aborted) return Promise.reject(new DOMException("The request was aborted.", "AbortError"));
  const base = import.meta.env.VITE_API_URL?.trim();
  if (!base) return Promise.resolve(emptyPublishedDashboardPayload);
  const url = `${base.replace(/\/$/, "")}/v1/watchlist`;
  const saved = cache.get(url);
  if (saved && Date.now() - saved.at < CACHE_TTL_MS) return Promise.resolve(saved.data);

  let request = pending.get(url);
  if (!request) {
    request = fetchDashboard(url).then((data) => {
      cache.set(url, { data, at: Date.now() });
      return data;
    }).finally(() => pending.delete(url));
    pending.set(url, request);
  }
  if (!signal) return request;
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("The request was aborted.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    request.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
