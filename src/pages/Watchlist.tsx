import { useEffect, useMemo, useState } from "react";
import AppShell, { CompanyBadge, Toast, TrashIcon } from "../components/AppShell";
import { useWatchlist } from "../components/watchlistStore";
import { getSignalStatus, type Company } from "../data";
import { loadDashboardPayload } from "../api/dashboard";

export default function Watchlist() {
  const [toast, setToast] = useState<"success" | "error" | null>(null);
  const { tickers, loading: watchlistLoading, remove } = useWatchlist();
  const [dashboardCompanies, setDashboardCompanies] = useState<Company[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    loadDashboardPayload(controller.signal).then((payload) => {
      setDashboardCompanies([...payload.affordable_growing, ...payload.popular_stable]);
    }).catch(() => {
      if (!controller.signal.aborted) setDashboardCompanies([]);
    }).finally(() => {
      if (!controller.signal.aborted) setDataLoading(false);
    });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const byTicker = new Map(dashboardCompanies.map((company) => [company.ticker, company]));
    return tickers.map((ticker) => byTicker.get(ticker) ?? {
      name: ticker,
      ticker,
      sector: "—",
      price: "—",
      score: 0,
      change: "—",
      sentiment: "Neutral" as const,
      reason: "This ticker is not in the current dashboard publication.",
    });
  }, [dashboardCompanies, tickers]);

  const removeCompany = (ticker: string) => { remove(ticker); setToast("error"); };

  return <AppShell title="Your Watchlist" subtitle="Active items tracked for analysis.">
    <div className="watchlist-toolbar"><span className="asset-pill">All Assets</span><span className="watchlist-count">{filtered.length} companies</span></div>
    <div className="panel">
      {watchlistLoading || (dataLoading && filtered.length > 0) ? <p className="auth-muted-line" role="status">Loading your saved companies…</p> : filtered.length === 0 ? <div className="empty-state"><div className="empty-state-icon">♡</div><h2>Your watchlist is empty</h2><p>Add companies from Market Health and they will appear here.</p><button className="btn-primary" onClick={() => window.location.assign("/")}>Explore Market Health</button></div> : <div className="table-wrap"><table className="data-table watchlist-table"><colgroup><col className="watchlist-company-column" /><col className="watchlist-sector-column" /><col className="watchlist-sentiment-column" /><col className="watchlist-confidence-column" /><col className="watchlist-signal-column" /><col className="watchlist-price-column" /><col className="watchlist-action-column" /></colgroup><thead><tr><th>Company name</th><th>Sector</th><th>Sentiment pulse</th><th>Confidence</th><th>Signal status</th><th>Current price</th><th /></tr></thead><tbody>{filtered.map((company) => { const signal = getSignalStatus(company); return <tr key={company.ticker}><td><CompanyBadge company={company}/></td><td><span className="sector-text">{company.sector}</span></td><td><span className={`tag ${company.sentiment === "Neutral" ? "tag-neutral" : company.sentiment === "Watch" ? "tag-watch" : ""}`}>● {company.sentiment}</span></td><td><strong>{company.score || "—"}</strong></td><td><span className={signal === "neutral" ? "signal-neutral" : signal === "down" ? "signal-down" : "signal-up"}>{signal === "neutral" ? "—" : signal === "down" ? "↓" : "↑"}</span></td><td><strong>{company.price}</strong><small className={company.change.startsWith("+") ? "metric-positive" : company.change.startsWith("-") ? "metric-negative" : ""}>{company.change}</small></td><td><button className="trash-button" onClick={() => removeCompany(company.ticker)} aria-label={`Remove ${company.name} from watchlist`}><TrashIcon /></button></td></tr>; })}</tbody></table></div>}
      {dataLoading && filtered.length > 0 && <p className="end-of-list" role="status">Loading current dashboard prices…</p>}
      {!dataLoading && filtered.some((company) => company.price === "—") && filtered.length > 0 && <p className="end-of-list" role="status">Some saved tickers are not in the current dashboard data, so their price is unavailable.</p>}
      <p className="end-of-list">{filtered.length ? "End of watchlist" : "Your saved companies will appear here"}</p>
    </div>
    {toast && <Toast type={toast} message="Removed from your Watchlist" onDone={() => setToast(null)} />}
  </AppShell>;
}
