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

export async function loadSecurityDetails(symbol: string, signal?: AbortSignal): Promise<SecurityDetails> {
  const baseUrl = import.meta.env.VITE_API_URL?.trim();
  if (!baseUrl) throw new Error("Company API is not configured.");

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/v1/securities/${encodeURIComponent(symbol)}`,
    { signal },
  );
  if (!response.ok) throw new Error(`Company API returned ${response.status}`);

  const payload = await response.json() as SecurityResponse;
  if (!payload.security || typeof payload.security.symbol !== "string") {
    throw new Error("Company API returned an invalid response.");
  }
  return payload.security;
}
