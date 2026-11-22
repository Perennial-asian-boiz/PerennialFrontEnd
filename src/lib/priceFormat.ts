// S3-01: how the Price Breakdown writes money, changes and trading days.

export function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(value);
}

// A trading day (YYYY-MM-DD) as written, never shifted by the viewer's time zone.
export function tradingDay(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}

// "+$7.59 (+4.16%)", or "−$2.17 (−1.18%)" with a real minus sign.
export function signedChange(change: number, percent: number, currency: string): string {
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  return `${sign}${money(Math.abs(change), currency)} (${sign}${Math.abs(percent).toFixed(2)}%)`;
}
