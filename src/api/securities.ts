/** Backend company contract from GET /v1/securities/{symbol} (S1-12). */
export type SecuritySummary = {
  text: string;
  source: { name: string; url: string };
  as_of: string;
};

export type Security = {
  symbol: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  exchange: string | null;
  summary: SecuritySummary | null;
};

export class SecurityNotFoundError extends Error {}

export async function loadSecurity(symbol: string, signal?: AbortSignal): Promise<Security> {
  const baseUrl = import.meta.env.VITE_API_URL?.trim();
  if (!baseUrl) throw new Error("VITE_API_URL is not configured.");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/securities/${encodeURIComponent(symbol)}`, { signal });
  if (response.status === 404 || response.status === 422) throw new SecurityNotFoundError(symbol);
  if (!response.ok) throw new Error(`Company API returned ${response.status}`);
  const payload = await response.json() as { security?: Partial<Security> };
  const security = payload.security;
  if (!security || typeof security.symbol !== "string") throw new Error("Company API returned an invalid response.");
  const summary = security.summary;
  const validSummary = summary && typeof summary.text === "string" && typeof summary.source?.url === "string"
    && summary.source.url.startsWith("https://") ? summary : null;
  return {
    symbol: security.symbol,
    name: security.name ?? null,
    sector: security.sector ?? null,
    industry: security.industry ?? null,
    exchange: security.exchange ?? null,
    summary: validSummary,
  };
}
