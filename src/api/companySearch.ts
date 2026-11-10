export type CompanySearchResult = {
  symbol: string;
  name: string | null;
  sector: string | null;
};

export type CompanySearchPage = {
  query: string;
  results: CompanySearchResult[];
  limit: number;
  offset: number;
  has_more: boolean;
};

export const COMPANY_SEARCH_PAGE_SIZE = 50;

export async function searchCompanies(query: string, offset = 0, signal?: AbortSignal): Promise<CompanySearchPage> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return { query: "", results: [], limit: COMPANY_SEARCH_PAGE_SIZE, offset: 0, has_more: false };
  const base = import.meta.env.VITE_API_URL?.trim();
  if (!base) throw new Error("Company search is not configured.");
  const params = new URLSearchParams({ q: normalizedQuery, limit: String(COMPANY_SEARCH_PAGE_SIZE), offset: String(offset) });
  const response = await fetch(`${base.replace(/\/$/, "")}/v1/securities?${params}`, { signal });
  if (!response.ok) throw new Error(`Company search returned ${response.status}.`);
  const body = await response.json();
  if (body?.api_version !== "v1" || body.query !== normalizedQuery || body.offset !== offset
    || body.limit !== COMPANY_SEARCH_PAGE_SIZE || typeof body.has_more !== "boolean"
    || !Array.isArray(body.results) || body.results.length > COMPANY_SEARCH_PAGE_SIZE
    || !body.results.every((row: CompanySearchResult) => row && typeof row.symbol === "string"
      && /^[A-Z0-9][A-Z0-9./-]{0,19}$/.test(row.symbol)
      && (row.name === null || typeof row.name === "string")
      && (row.sector === null || typeof row.sector === "string"))
    || new Set(body.results.map((row: CompanySearchResult) => row.symbol)).size !== body.results.length
    || (body.has_more && body.results.length !== COMPANY_SEARCH_PAGE_SIZE)) {
    throw new Error("Company search returned an invalid response.");
  }
  return body as CompanySearchPage;
}
