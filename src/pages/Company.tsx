import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { loadSecurityDetails, type SecurityDetails } from "../api/company";
import { FinancialsApiError, loadFinancials, type FinancialsResponse } from "../api/financials";
import AppShell, { Toast } from "../components/AppShell";
import ScoreBreakdown from "../components/ScoreBreakdown";
import ScoreCard from "../components/ScoreCard";
import PublicFloatMetric from "../components/PublicFloatMetric";
import { useSecFilings } from "../components/useSecFilings";
import type { PublicFloat } from "../lib/publicFloat";
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
  const filingsUrl = useSecFilings(security?.symbol ?? symbol);
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
      <WhyPanel state={score} filingsUrl={filingsUrl} />
      <FinancialsSection symbol={security.symbol} companyName={name} publicFloat={security.publicFloat ?? null} />
    </>}
    {toast && <Toast type="success" message="Successfully added to your Watchlist" onDone={() => setToast(null)} />}
  </AppShell>;
}

// Price and sentiment remain explicit placeholders until their API fields exist.
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

function FinancialsSection({ symbol, companyName, publicFloat }: {
  symbol: string; companyName: string; publicFloat: PublicFloat | null;
}) {
  const [result, setResult] = useState<{ symbol: string; data: FinancialsResponse | null; error: string }>({
    symbol: "",
    data: null,
    error: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    loadFinancials(symbol, controller.signal).then((data) => {
      setResult({ symbol, data, error: "" });
    }).catch((caught: unknown) => {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      const error = caught instanceof FinancialsApiError && caught.status === 404
        ? "The financials endpoint or data is not available for this company yet."
        : "Financial data could not be loaded.";
      setResult({ symbol, data: null, error });
    });
    return () => controller.abort();
  }, [symbol]);

  const isCurrent = result.symbol === symbol;
  const financials = isCurrent ? result.data : null;
  const error = isCurrent ? result.error : "";
  const loading = !isCurrent;
  const years = financials?.status === "ok" ? financials.years : [];
  const latest = years[0] ?? null;
  const revenueHistory = [...years].reverse().filter((year) => year.revenue !== null);
  const maxRevenue = Math.max(...revenueHistory.map((year) => Math.max(year.revenue!.value, 0)), 0);
  const yAxisMax = chartAxisMax(maxRevenue);
  const yAxisTicks = [yAxisMax, yAxisMax * 2 / 3, yAxisMax / 3, 0];
  const yAxisUnit = revenueHistory[0]?.revenue?.unit ?? "USD";

  return <section className="panel detail-data-card financials-card" aria-labelledby="financials-heading">
    <div className="financials-header">
      <h2 id="financials-heading">{companyName} Finance</h2>
      <span>SEC EDGAR · Annual</span>
    </div>
    <div className="financial-metrics-list" aria-label="Key financial metrics">
      <PublicFloatMetric value={publicFloat} />
      <FinancialMetric label="Revenue" value={loading ? "Loading…" : formatAmount(latest?.revenue ?? null)} detail={latest ? `FY ended ${formatFiscalYear(latest.fiscal_year_end)}` : undefined} />
      <FinancialMetric label="Net Income" value={loading ? "Loading…" : formatAmount(latest?.net_income ?? null)} />
      <FinancialMetric label="Revenue Growth" value={loading ? "Loading…" : formatPercent(latest?.revenue_growth ?? null)} />
      <FinancialMetric label="Net Margin" value={loading ? "Loading…" : formatPercent(latest?.net_margin ?? null)} />
      <FinancialMetric label="Debt / Equity" value={loading ? "Loading…" : formatRatio(latest?.debt_to_equity ?? null)} />
    </div>
    <div className="financial-chart-card">
      <div className="financial-chart-heading">
        <div><strong>Revenue by Fiscal Year</strong><span className="financial-chart-badge">{loading ? "Loading" : financials?.status === "ok" ? "SEC reported" : "Data unavailable"}</span></div>
        <span>Annual reported values</span>
      </div>
      {revenueHistory.length > 0 ? <div className="financial-chart-plot financial-chart-plot-populated" role="img" aria-label={`Annual revenue from ${formatFiscalYear(revenueHistory[0].fiscal_year_end)} to ${formatFiscalYear(revenueHistory[revenueHistory.length - 1].fiscal_year_end)}`}>
        <div className="financial-chart-canvas">
          <div className="financial-chart-grid" aria-hidden="true"><span /><span /><span /><span /></div>
          <div className="financial-chart-y-axis" aria-hidden="true">
            {yAxisTicks.map((tick, index) => <span key={index}>{formatAxisAmount(tick, yAxisUnit)}</span>)}
          </div>
          <div className="financial-revenue-bars">
            {revenueHistory.map((year, index) => {
              const amount = year.revenue!;
              const height = Math.max(0, amount.value) / yAxisMax * 100;
              return <div className={`financial-bar-column${index % 2 === 1 ? " financial-bar-column-label-raised" : ""}`} key={year.fiscal_year_end}>
                <strong className="financial-bar-value" style={{ bottom: `calc(${height}% + 38px)` }}>{formatAmount(amount)}</strong>
                <span className={`financial-bar${index === revenueHistory.length - 1 ? " financial-bar-current" : ""}`} style={{ height: `${height}%` }} />
                <span className={`financial-bar-year${index === revenueHistory.length - 1 ? " financial-bar-year-current" : ""}`}>{formatFiscalYear(year.fiscal_year_end)}</span>
              </div>;
            })}
          </div>
        </div>
      </div> : <div className="financial-chart-plot" role="status">
        <div className="financial-chart-grid" aria-hidden="true"><span /><span /><span /><span /></div>
        <p>{loading ? "Loading annual financial data…" : error || "Revenue history will appear when annual financial data is available."}</p>
      </div>}
      <div className="financial-chart-footer"><span>Fiscal year ended</span><span>{latest ? `Filed ${latest.filed} · ${financials?.source ?? "SEC EDGAR"}` : "Values are shown when supplied by the API."}</span></div>
    </div>
    {financials?.revenue_basis === "revenue_net_of_interest" && <div className="financials-footnote"><span>ⓘ</span> Revenue is reported net of interest for this bank.</div>}
  </section>;
}

function FinancialMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="financial-metric-row"><span>{label}</span><div><strong>{value}</strong>{detail && <small>{detail}</small>}</div></div>;
}

function formatAmount(amount: { value: number; unit: string } | null) {
  if (!amount) return "Not available";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: amount.unit,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount.value);
  } catch {
    return `${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(amount.value)} ${amount.unit}`;
  }
}

function formatPercent(value: number | null) {
  if (value === null) return "Not available";
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function formatRatio(value: number | null) {
  if (value === null) return "Not available";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatFiscalYear(value: string) {
  return value.slice(0, 4);
}

function chartAxisMax(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  // Reserve headroom above the tallest bar so its value label stays clear of
  // the chart's top grid line as revenue values change between companies.
  const targetMax = value * 1.15;
  const targetStep = targetMax / 3;
  const magnitude = 10 ** Math.floor(Math.log10(targetStep));
  const normalizedStep = targetStep / magnitude;
  const niceFactors = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const factor = niceFactors.find((candidate) => candidate >= normalizedStep) ?? 10;
  return factor * magnitude * 3;
}

function formatAxisAmount(value: number, unit: string) {
  return value === 0 ? "$0" : formatAmount({ value, unit });
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
