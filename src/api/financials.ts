// GET /v1/securities/{symbol}/financials (S2-04): annual SEC financial data.

export type FinancialAmount = {
  value: number;
  unit: string;
};

export type FinancialYear = {
  fiscal_year_end: string;
  form: string;
  filed: string;
  revenue: FinancialAmount | null;
  net_income: FinancialAmount | null;
  long_term_debt: FinancialAmount | null;
  equity: FinancialAmount | null;
  operating_cash_flow: FinancialAmount | null;
  revenue_growth: number | null;
  net_margin: number | null;
  debt_to_equity: number | null;
};

export type FinancialsResponse = {
  api_version: string;
  symbol: string;
  source: string;
  status: "ok" | "unavailable";
  batch_id: number | null;
  revenue_basis: string | null;
  years: FinancialYear[];
};

export class FinancialsApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "FinancialsApiError";
    this.status = status;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAmount(value: unknown): value is FinancialAmount | null {
  return value === null || (isObject(value)
    && typeof value.value === "number"
    && Number.isFinite(value.value)
    && typeof value.unit === "string");
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isFinancialYear(value: unknown): value is FinancialYear {
  return isObject(value)
    && typeof value.fiscal_year_end === "string"
    && typeof value.form === "string"
    && typeof value.filed === "string"
    && isAmount(value.revenue)
    && isAmount(value.net_income)
    && isAmount(value.long_term_debt)
    && isAmount(value.equity)
    && isAmount(value.operating_cash_flow)
    && isNumberOrNull(value.revenue_growth)
    && isNumberOrNull(value.net_margin)
    && isNumberOrNull(value.debt_to_equity);
}

function isFinancialsResponse(value: unknown): value is FinancialsResponse {
  return isObject(value)
    && typeof value.api_version === "string"
    && typeof value.symbol === "string"
    && typeof value.source === "string"
    && (value.status === "ok" || value.status === "unavailable")
    && (value.batch_id === null || typeof value.batch_id === "number")
    && (value.revenue_basis === null || typeof value.revenue_basis === "string")
    && Array.isArray(value.years)
    && value.years.every(isFinancialYear);
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { response: FinancialsResponse; cachedAt: number }>();
const pending = new Map<string, Promise<FinancialsResponse>>();

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

export async function loadFinancials(symbol: string, signal?: AbortSignal): Promise<FinancialsResponse> {
  const baseUrl = import.meta.env.VITE_API_URL?.trim();
  if (!baseUrl) throw new FinancialsApiError("Financials API is not configured.", null);

  const normalizedSymbol = symbol.trim().toUpperCase();
  const url = `${baseUrl.replace(/\/$/, "")}/v1/securities/${encodeURIComponent(normalizedSymbol)}/financials`;
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
      if (!response.ok) throw new FinancialsApiError(`Financials API returned ${response.status}`, response.status);
      if (!isFinancialsResponse(payload)) throw new FinancialsApiError("Financials API returned an invalid response.", response.status);
      cache.set(url, { response: payload, cachedAt: Date.now() });
      return payload;
    }).finally(() => pending.delete(url));
    pending.set(url, request);
  }

  return waitForRequest(request, signal);
}
