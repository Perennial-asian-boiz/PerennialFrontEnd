import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { loadSecurityDetails, type SecurityDetails } from "../api/company";
import AppShell, { Toast } from "../components/AppShell";
import ScoreBreakdown from "../components/ScoreBreakdown";
import ScoreCard from "../components/ScoreCard";
import { useScore } from "../components/useScore";
import WhyPanel from "../components/WhyPanel";
import { useWatchlist } from "../components/watchlistStore";

export default function Company() {
  const navigate = useNavigate();
  const location = useLocation();
  const { symbol: routeSymbol } = useParams<{ symbol: string }>();
  const symbol = routeSymbol?.trim().toUpperCase() ?? "";
  const [result, setResult] = useState<{ symbol: string; security: SecurityDetails | null; error: string }>({
    symbol: "",
    security: null,
    error: "",
  });
  const [toast, setToast] = useState<"success" | null>(null);
  const { isWatched, add } = useWatchlist();
  // Loaded alongside the details, not after them; the route resolves an alias itself.
  const score = useScore(symbol);

  useEffect(() => {
    if (!symbol) return;

    const controller = new AbortController();
    loadSecurityDetails(symbol, controller.signal).then((security) => {
      setResult({ symbol, security, error: "" });
    }).catch((caught: unknown) => {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setResult({
        symbol,
        security: null,
        error: caught instanceof Error && caught.message.includes("404")
          ? "Company details are not available for this ticker yet."
          : "Unable to load company details. Please try again.",
      });
    });

    return () => controller.abort();
  }, [symbol]);

  const resultIsCurrent = result.symbol === symbol;
  const security = resultIsCurrent ? result.security : null;
  const error = resultIsCurrent ? result.error : "";
  const loading = Boolean(symbol) && !resultIsCurrent;
  const name = security?.name || security?.symbol || symbol;
  const goBack = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) navigate(-1);
    else navigate(location.pathname.startsWith("/company-preview/") ? "/dashboard-preview" : "/");
  };

  return <AppShell title="Company details" subtitle="Company information from the Perennial API." hidePageHeading>
    {location.pathname.startsWith("/company-preview/") && <p className="company-preview-notice" role="note">Preview mode: values come from the configured API. Fields the API does not provide are marked unavailable.</p>}
    <div className="company-detail-topline">
      <button className="btn-primary company-back-button" type="button" onClick={goBack}>Back</button>
      <span className="company-detail-divider" aria-hidden="true" />
      <div className="company-detail-identity">
        <h1>{security ? name : symbol || "Company details"}</h1>
        {security && <><span className="company-detail-chip">{security.symbol}</span><span className="company-detail-chip company-detail-sector">{security.sector ?? "Sector unavailable"}</span></>}
      </div>
      {loading ? <span className="loading-bar company-watch-loading" aria-hidden="true" /> : security && !isWatched(security.symbol) && <button className="btn-primary company-detail-watch" onClick={() => { add(security.symbol); setToast("success"); }}>＋ Add to watchlist</button>}
    </div>
    {!symbol ? <p className="auth-muted-line" role="status">Search for a company to view its details.</p> : loading ? <div className="company-loading" role="status" aria-label={`Loading ${symbol} company details`}>
      <div className="section-heading"><span className="loading-bar company-loading-heading" /></div>
      <div className="panel company-loading-panel"><span className="loading-bar company-loading-line" /><span className="loading-bar company-loading-line company-loading-line-short" /><span className="loading-bar company-loading-source" /></div>
    </div> : error ? <p className="auth-error" role="alert">{error}</p> : security && <>
      {/* The Figma "About" card, shown only when a summary is stored; the score card follows. */}
      <section className="panel about-card" aria-labelledby="about-heading">
        <h2 id="about-heading" className="card-title">About</h2>
        {security.summary ? <>
          <p className="about-text"><AboutText name={security.name} text={security.summary.text} url={security.summary.source.url} /></p>
          <a className="company-summary-source" href={security.summary.source.url} target="_blank" rel="noreferrer">Source: {security.summary.source.name}</a>
        </> : <p className="detail-data-note">Company description is not included in the current API response.</p>}
      </section>
      <ScoreCard state={score} />
      <ScoreBreakdown state={score} />
      <CompanyDetailSections />
      <WhyPanel state={score} />
      <FinancialsSection companyName={name} marketCap={security.current?.entry?.market_cap ?? null} />
    </>}
    {toast && <Toast type="success" message="Successfully added to your Watchlist" onDone={() => setToast(null)} />}
  </AppShell>;
}

// These Figma sections are intentionally data-empty until the API serves their
// underlying fields. Keeping the structure here lets the backend response be
// wired into the same components later without presenting invented numbers.
function CompanyDetailSections() {
  const [sentimentChannel, setSentimentChannel] = useState<"news" | "social">("news");

  return <>
    <section className="panel detail-data-card" aria-labelledby="price-breakdown-heading">
      <div className="detail-data-heading">
        <div><h2 id="price-breakdown-heading" className="detail-data-title">Price Breakdown</h2><p>Market price and valuation range</p></div>
        <span className="detail-data-unavailable">Awaiting market-price data</span>
      </div>
      <div className="price-summary-grid">
        <Metric label="Current price" value="Not available" />
        <Metric label="Fair value range" value="Not available" />
      </div>
      <div className="range-placeholder" role="status">
        <span>52-week range will appear when price history is available.</span>
        <div className="range-placeholder-track" aria-hidden="true" />
      </div>
    </section>

    <section className="panel detail-data-card" aria-labelledby="sentiment-pulse-heading">
      <div className="detail-data-heading">
        <div><h2 id="sentiment-pulse-heading" className="detail-data-title">Sentiment Pulse</h2><p>News and social sentiment</p></div>
      </div>
      <div className="sentiment-tabs" role="group" aria-label="Sentiment source">
        <button type="button" className={sentimentChannel === "news" ? "selected" : ""} aria-pressed={sentimentChannel === "news"} onClick={() => setSentimentChannel("news")}>News</button>
        <button type="button" className={sentimentChannel === "social" ? "selected" : ""} aria-pressed={sentimentChannel === "social"} onClick={() => setSentimentChannel("social")}>Social</button>
      </div>
      <SentimentBars channel={sentimentChannel} />
      <p className="detail-data-note sentiment-unavailable-note">Sentiment values are not available yet.</p>
    </section>
  </>;
}

function FinancialsSection({ companyName, marketCap }: { companyName: string; marketCap: number | null }) {
  return <section className="panel detail-data-card financials-card" aria-labelledby="financials-heading">
    <div className="financials-header">
      <h2 id="financials-heading">{companyName} Finance</h2>
      <span>Key metrics</span>
    </div>
    <div className="financial-metrics-list" aria-label="Key financial metrics">
      <FinancialMetric label="Market Cap" value={formatMarketCap(marketCap)} />
      <FinancialMetric label="Revenue" value="Not available" />
      <FinancialMetric label="Revenue Growth" value="Not available" />
      <FinancialMetric label="Debt / Equity" value="Not available" />
    </div>
    <div className="financial-chart-card" role="status">
      <div className="financial-chart-heading">
        <div><strong>Revenue Growth (YoY)</strong><span className="financial-chart-badge">Awaiting API data</span></div>
        <span>Historical &amp; projections</span>
      </div>
      <div className="financial-chart-plot">
        <div className="financial-chart-grid" aria-hidden="true"><span /><span /><span /><span /></div>
        <p>Revenue history will appear when annual financial data is available.</p>
      </div>
      <div className="financial-chart-footer"><span>Fiscal year reported</span><span>Values will include their reporting period and source.</span></div>
    </div>
    <div className="financials-footnote"><span>ⓘ</span> Financial metrics are shown only when supplied by the API.</div>
  </section>;
}

function FinancialMetric({ label, value }: { label: string; value: string }) {
  return <div className="financial-metric-row"><span>{label}</span><strong>{value}</strong></div>;
}

function formatMarketCap(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="detail-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function SentimentBars({ channel }: { channel: "news" | "social" }) {
  const sentiments = [
    { label: "Positive", className: "positive" },
    { label: "Mix", className: "mixed" },
    { label: "Negative", className: "negative" },
  ];

  return <div className="sentiment-bars" aria-label={`${channel === "news" ? "News" : "Social"} sentiment breakdown`}>
    {sentiments.map(({ label, className }) => <div className={`sentiment-meter ${className}`} key={label}>
      <div className="sentiment-meter-track" aria-hidden="true"><span /></div>
      <div className="sentiment-meter-caption"><span>{label}</span><strong aria-label={`${label}: not available`}>—</strong></div>
    </div>)}
  </div>;
}

// As in Figma, a summary that opens with the company's name links the name to its source.
function AboutText({ name, text, url }: { name: string | null; text: string; url: string }) {
  if (!name || !text.startsWith(name)) return <>{text}</>;
  return <><a className="about-name" href={url} target="_blank" rel="noreferrer">{name}</a>{text.slice(name.length)}</>;
}
