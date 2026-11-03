export type CompanySummary = {
  text: string;
  source: {
    name: string;
    url: string;
  };
  as_of: string;
};

export type SecurityDetails = {
  symbol: string;
  name: string | null;
  sector: string | null;
  summary: CompanySummary | null;
};

type SecurityResponse = {
  security: SecurityDetails;
};

const SECURITY_CACHE_TTL_MS = 30_000;
const securityCache = new Map<string, { security: SecurityDetails; cachedAt: number }>();
const pendingSecurityRequests = new Map<string, Promise<SecurityDetails>>();

function waitForRequest<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(new DOMException("The request was aborted.", "AbortError"));

  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(new DOMException("The request was aborted.", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    request.then((value) => {
      signal.removeEventListener("abort", abort);
      resolve(value);
    }, (error: unknown) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
}

export async function loadSecurityDetails(symbol: string, signal?: AbortSignal): Promise<SecurityDetails> {
  const baseUrl = import.meta.env.VITE_API_URL?.trim();
  if (!baseUrl) throw new Error("Company API is not configured.");

  const normalizedSymbol = symbol.trim().toUpperCase();
  const apiUrl = `${baseUrl.replace(/\/$/, "")}/v1/securities/${encodeURIComponent(normalizedSymbol)}`;
  if (signal?.aborted) throw new DOMException("The request was aborted.", "AbortError");

  const cached = securityCache.get(apiUrl);
  if (cached && Date.now() - cached.cachedAt < SECURITY_CACHE_TTL_MS) return cached.security;

  let request = pendingSecurityRequests.get(apiUrl);
  if (!request) {
    request = fetch(apiUrl).then(async (response) => {
      if (!response.ok) throw new Error(`Company API returned ${response.status}`);
      const payload = await response.json() as SecurityResponse;
      if (!payload.security || typeof payload.security.symbol !== "string") {
        throw new Error("Company API returned an invalid response.");
      }
      securityCache.set(apiUrl, { security: payload.security, cachedAt: Date.now() });
      return payload.security;
    }).finally(() => pendingSecurityRequests.delete(apiUrl));
    pendingSecurityRequests.set(apiUrl, request);
  }

  return waitForRequest(request, signal);
}
