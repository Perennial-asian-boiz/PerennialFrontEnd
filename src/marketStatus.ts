/** Backend market status contract from GET /v1/market-status. */
export type MarketStatus = {
  exchange: string;
  is_open: boolean;
  label: string;
  session: "regular" | "closed";
  note: string;
  as_of: string;
  next_open: string;
  next_close: string;
  early_close: boolean;
};

export function formatNextMarketOpen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(date);
}

export async function loadMarketStatus(signal?: AbortSignal): Promise<MarketStatus | null> {
  const baseUrl = import.meta.env.VITE_API_URL?.trim();
  if (!baseUrl) return null;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/market-status`, { signal });
  if (!response.ok) throw new Error(`Market status API returned ${response.status}`);

  const payload = await response.json() as Partial<MarketStatus>;
  if (
    typeof payload.exchange !== "string"
    || typeof payload.is_open !== "boolean"
    || typeof payload.label !== "string"
  ) {
    throw new Error("Market status API returned an invalid response.");
  }
  return payload as MarketStatus;
}
