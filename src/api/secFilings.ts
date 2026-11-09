// The bundled index comes directly from SEC's public company_tickers.json.
// Numeric CIKs avoid sending tickers to EDGAR's CIK-only browse page.
let indexRequest: Promise<Record<string, unknown>> | null = null;

export async function loadSecFilingsUrl(symbol: string): Promise<string | null> {
  if (!symbol.trim()) return null;
  if (!indexRequest) {
    indexRequest = fetch(`${import.meta.env.BASE_URL ?? "/"}sec-company-ciks.json`).then(async (response) => {
      if (!response.ok) throw new Error("SEC company index is unavailable.");
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !("tickers" in data) || !data.tickers || typeof data.tickers !== "object") {
        throw new Error("SEC company index is invalid.");
      }
      return data.tickers as Record<string, unknown>;
    }).catch((error: unknown) => { indexRequest = null; throw error; });
  }
  const tickers = await indexRequest;
  const ticker = symbol.trim().toUpperCase();
  const cik = tickers[ticker] ?? tickers[ticker.replaceAll(".", "-")];
  if (typeof cik !== "number" || !Number.isSafeInteger(cik) || cik <= 0 || cik > 9_999_999_999) return null;
  return `https://www.sec.gov/edgar/browse/?CIK=${cik}&owner=exclude`;
}
