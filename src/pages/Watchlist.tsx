import { useState } from "react";
import AppShell, { CompanyBadge, Toast, TrashIcon } from "../components/AppShell";
import { useWatchlist } from "../components/watchlistStore";
import { allCompanies, getSignalStatus } from "../data";

export default function Watchlist() {
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<"success" | "error" | null>(null);
  const { isWatched, remove } = useWatchlist();
  const filtered = allCompanies.filter((company) => isWatched(company.ticker) && `${company.name} ${company.ticker} ${company.sector}`.toLowerCase().includes(query.toLowerCase()));
  const removeCompany = (ticker: string) => { remove(ticker); setToast("error"); };

  return <AppShell title="Your Watchlist" subtitle="Active items tracked for analysis.">
    <div className="watchlist-toolbar"><span className="asset-pill">All Assets</span><span className="watchlist-count">{filtered.length} companies</span></div>
    <div className="panel">
      <div className="form-field" style={{ marginBottom: 22 }}><label htmlFor="company-search">Investment portfolio</label><input id="company-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stocks, tickers, events (e.g. NVDA, RBLX)..." /></div>
      {filtered.length === 0 ? <div className="empty-state"><div className="empty-state-icon">♡</div><h2>Your watchlist is empty</h2><p>Add companies from Market Health and they will appear here.</p><button className="btn-primary" onClick={() => window.location.assign("/")}>Explore Market Health</button></div> : <div className="table-wrap"><table className="data-table watchlist-table"><colgroup><col className="watchlist-company-column" /><col className="watchlist-sector-column" /><col className="watchlist-sentiment-column" /><col className="watchlist-confidence-column" /><col className="watchlist-signal-column" /><col className="watchlist-price-column" /><col className="watchlist-action-column" /></colgroup><thead><tr><th>Company name</th><th>Sector</th><th>Sentiment pulse</th><th>Confidence</th><th>Signal status</th><th>Current price</th><th /></tr></thead><tbody>{filtered.map((company) => { const signal = getSignalStatus(company); return <tr key={company.ticker}><td><CompanyBadge company={company}/></td><td><span className="sector-text">{company.sector}</span></td><td><span className={`tag ${company.sentiment === "Neutral" ? "tag-neutral" : company.sentiment === "Watch" ? "tag-watch" : ""}`}>● {company.sentiment}</span></td><td><strong>{company.score}</strong></td><td><span className={signal === "neutral" ? "signal-neutral" : signal === "down" ? "signal-down" : "signal-up"}>{signal === "neutral" ? "—" : signal === "down" ? "↓" : "↑"}</span></td><td><strong>{company.price}</strong><small className={company.change.startsWith("+") ? "metric-positive" : "metric-negative"}>{company.change}</small></td><td><button className="trash-button" onClick={() => removeCompany(company.ticker)} aria-label={`Remove ${company.name} from watchlist`}><TrashIcon /></button></td></tr>; })}</tbody></table></div>}
      <p className="end-of-list">{filtered.length ? "End of watchlist" : "Your saved companies will appear here"}</p>
    </div>
    {toast && <Toast type={toast} message="Removed from your Watchlist" onDone={() => setToast(null)} />}
  </AppShell>;
}
