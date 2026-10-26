import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell, { Toast } from "../components/AppShell";
import { useWatchlist } from "../components/watchlistStore";
import { getSignalStatus } from "../data";
import { emptyDashboardPayload, getDashboardSections, type DashboardBucket } from "../dashboardData";
import { loadDashboardPayload } from "../api/dashboard";
import { getCachedPreferences, getPreferences, getSessionToken, isAuthApiConfigured } from "../api/auth";
import { formatMarketTime, loadMarketStatus, type MarketStatus } from "../marketStatus";

export default function Dashboard() {
  const [view, setView] = useState("Affordable & Growing");
  const [toast, setToast] = useState<"success" | "error" | null>(null);
  const apiConfigured = Boolean(import.meta.env.VITE_API_URL?.trim());
  const [payload, setPayload] = useState(emptyDashboardPayload);
  const [dashboardUnavailable, setDashboardUnavailable] = useState(!apiConfigured);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [selectedSectors, setSelectedSectors] = useState<string[]>(() => getCachedPreferences()?.sectors ?? []);
  const [preferencesLoading, setPreferencesLoading] = useState(() => (
    isAuthApiConfigured() && Boolean(getSessionToken()) && getCachedPreferences() === null
  ));
  const { isWatched, add } = useWatchlist();
  const bucket: DashboardBucket = view === "Popular & Stable" ? "popular_stable" : "affordable_growing";
  const sections = getDashboardSections(payload, selectedSectors, bucket);
  useEffect(() => {
    const controller = new AbortController();
    loadDashboardPayload(controller.signal).then((nextPayload) => {
      setPayload(nextPayload);
      setDashboardUnavailable(!apiConfigured);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (apiConfigured) {
        setPayload(emptyDashboardPayload);
        setDashboardUnavailable(true);
      }
    });
    const refreshMarketStatus = () => {
      loadMarketStatus(controller.signal).then(setMarketStatus).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMarketStatus(null);
      });
    };
    refreshMarketStatus();
    const loadPreferences = () => {
      if (!isAuthApiConfigured() || !getSessionToken()) {
        setSelectedSectors([]);
        setPreferencesLoading(false);
        return;
      }
      const cachedPreferences = getCachedPreferences();
      if (cachedPreferences) setSelectedSectors(cachedPreferences.sectors);
      else setPreferencesLoading(true);
      getPreferences().then((preferences) => {
        setSelectedSectors(preferences.sectors);
      }).catch(() => {
        if (!cachedPreferences) setSelectedSectors([]);
      }).finally(() => setPreferencesLoading(false));
    };
    loadPreferences();
    window.addEventListener("perennial-auth-changed", loadPreferences);
    const timer = window.setInterval(refreshMarketStatus, 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("perennial-auth-changed", loadPreferences);
    };
  }, [apiConfigured]);
  return <AppShell title="Market Health" subtitle="Curated market opportunities and sector trend monitors." headerActions={<div className="segmented"><button className={view === "Affordable & Growing" ? "selected" : ""} onClick={() => setView("Affordable & Growing")}>Affordable &amp; Growing</button><button className={view === "Popular & Stable" ? "selected" : ""} onClick={() => setView("Popular & Stable")}>Popular &amp; Stable</button></div>}>
    <div className="market-toolbar"><div><span className={`market-status ${marketStatus ? (marketStatus.is_open ? "market-status-open" : "market-status-closed") : ""}`} aria-live="polite"><span className="market-status-dot" aria-hidden="true" />{marketStatus?.label ?? "—"} · {marketStatus?.exchange ?? "—"}{marketStatus && (marketStatus.is_open ? ` · closes ${formatMarketTime(marketStatus.next_close)}` : ` · opens ${formatMarketTime(marketStatus.next_open)}`)}</span>{marketStatus?.note && <p className="market-status-note">{marketStatus.note}</p>}</div></div>
    {preferencesLoading ? <p className="auth-muted-line" role="status">Loading your selected sectors…</p> : <div className="market-sections">{sections.map((section) => <section className="market-section" key={section.name}><div className="market-section-heading"><span className="sector-pill">{section.name}</span><button className="view-all">View all →</button></div><div className="table-wrap"><table className="market-table"><colgroup><col className="market-company-column" /><col className="market-signal-column" /><col className="market-price-column" /><col className="market-action-column" /></colgroup><thead><tr><th>Company / ticker</th><th>Signal status</th><th>Price</th><th>Action</th></tr></thead><tbody>{section.items.length === 0 ? <tr><td><strong>—</strong><small>—</small></td><td>—</td><td>—</td><td><span className="watch-placeholder" aria-hidden="true" /></td></tr> : section.items.map((company) => { const signal = getSignalStatus(company); return <tr key={company.ticker}><td><Link className="company-link" to={`/company/${encodeURIComponent(company.ticker)}`}><strong>{company.name}</strong><small>{company.ticker}</small></Link></td><td><span className={signal === "neutral" ? "signal-neutral" : signal === "down" ? "signal-down" : "signal-up"}>{signal === "neutral" ? "—" : signal === "down" ? "↓" : "↑"}</span></td><td>{company.price}</td><td><span className="watch-action">{isWatched(company.ticker) ? <span className="watch-placeholder" aria-hidden="true" /> : <button className="watch-button" onClick={() => { add(company.ticker); setToast("success"); }}>＋ Watchlist</button>}</span></td></tr>; })}</tbody></table></div>{dashboardUnavailable && <p className="auth-muted-line" role="status">Backend data will appear here when the API is available.</p>}</section>)}</div>}
    {toast && <Toast type={toast} message="Successfully added to your Watchlist" onDone={() => setToast(null)} />}
  </AppShell>;
}
