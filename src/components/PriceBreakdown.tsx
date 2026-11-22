import { useEffect, useState, type ReactNode } from "react";
import { loadPrice, type PriceResponse } from "../api/price";
import { money, signedChange, tradingDay } from "../lib/priceFormat";

// S3-01: the Company page's Price Breakdown, from GET /v1/securities/{symbol}/price.
// Only prices the API serves are shown; with none, the card says "Price unavailable"
// and never shows a number (AC 4).

export type PriceState =
  | { kind: "loading" }
  | { kind: "ready"; price: PriceResponse }
  | { kind: "error" };

function Day({ value }: { value: string }) {
  return <time dateTime={value}>{tradingDay(value)}</time>;
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return <div className="detail-metric"><span>{label}</span><strong>{children}</strong></div>;
}

function Unavailable({ note }: { note: string }) {
  return <>
    <div className="price-summary-grid">
      <Metric label="Latest close">Price unavailable</Metric>
      <Metric label="Fair value range">Not available</Metric>
    </div>
    <p className="detail-data-note price-unavailable-note" role="status">{note}</p>
  </>;
}

function Range({ price }: { price: PriceResponse }) {
  const { high_52w: high, low_52w: low, close, currency } = price;
  if (high === null || low === null || close === null || currency === null) {
    return <p className="detail-data-note">52-week range not available.</p>;
  }
  const position = high > low ? Math.min(1, Math.max(0, (close - low) / (high - low))) : 0.5;
  return <div className="price-range">
    <div className="price-range-ends">
      <span>52-week low<strong>{money(low, currency)}</strong>{price.low_52w_date && <small><Day value={price.low_52w_date} /></small>}</span>
      <span>52-week high<strong>{money(high, currency)}</strong>{price.high_52w_date && <small><Day value={price.high_52w_date} /></small>}</span>
    </div>
    <div className="price-range-track" role="img" aria-label={`Latest close is ${Math.round(position * 100)}% of the way from the 52-week low to the high`}>
      <span className="price-range-marker" style={{ left: `${(position * 100).toFixed(1)}%` }} />
    </div>
  </div>;
}

export function PriceBreakdownView({ state }: { state: PriceState }) {
  const price = state.kind === "ready" && state.price.status === "ok" ? state.price : null;
  const badge = state.kind === "loading" ? "Loading" : price ? (price.stale ? "Older price" : "Latest close") : "Price unavailable";

  return <section className="panel detail-data-card" aria-labelledby="price-breakdown-heading">
    <div className="detail-data-heading">
      <div><h2 id="price-breakdown-heading" className="detail-data-title">Price Breakdown</h2><p>Latest close and 52-week range</p></div>
      <span className={price && !price.stale ? "financial-chart-badge" : "detail-data-unavailable"}>{badge}</span>
    </div>
    {state.kind === "loading" ? <span className="loading-bar company-loading-line" aria-label="Loading price" />
      : state.kind === "error" ? <Unavailable note="The price couldn't be loaded right now." />
      : !price || price.close === null || price.currency === null || price.as_of === null
        ? <Unavailable note="No price from a licensed source is stored for this company yet." />
        : <>
          <div className="price-summary-grid price-summary-grid-three">
            <Metric label="Latest close">{money(price.close, price.currency)}</Metric>
            <Metric label="Day's change">
              {price.change === null || price.change_percent === null ? "Not available"
                : <span className={price.change > 0 ? "price-up" : price.change < 0 ? "price-down" : undefined}>
                  {signedChange(price.change, price.change_percent, price.currency)}
                </span>}
            </Metric>
            <Metric label="Fair value range">Not available</Metric>
          </div>
          <Range price={price} />
          <p className="price-source">
            Source: {price.source} · Close of <Day value={price.as_of} /> · {price.currency}
          </p>
          {price.stale && <p className="detail-data-note price-stale-note" role="status">
            This is the latest close we have. Newer prices haven't arrived yet.
          </p>}
        </>}
  </section>;
}

// One request per company page; a failed request shows "Price unavailable", never a guess.
export default function PriceBreakdown({ symbol }: { symbol: string }) {
  const [result, setResult] = useState<{ symbol: string; state: PriceState }>({ symbol: "", state: { kind: "loading" } });

  useEffect(() => {
    if (!symbol) return;
    const controller = new AbortController();
    loadPrice(symbol, controller.signal).then((price) => {
      setResult({ symbol, state: { kind: "ready", price } });
    }).catch((caught: unknown) => {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setResult({ symbol, state: { kind: "error" } });
    });
    return () => controller.abort();
  }, [symbol]);

  return <PriceBreakdownView state={result.symbol === symbol ? result.state : { kind: "loading" }} />;
}
