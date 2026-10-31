import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell, { Toast } from "../components/AppShell";
import { useWatchlist } from "../components/watchlistStore";
import { getSignalStatus } from "../data";
import { emptyDashboardPayload, getDashboardSections, type DashboardBucket } from "../dashboardData";
import { loadDashboardPayload } from "../api/dashboard";
import { getCachedPreferences, getPreferences, getSessionToken, isAuthApiConfigured } from "../api/auth";
import { formatNextMarketOpen, loadMarketStatus, type MarketStatus } from "../marketStatus";

export default function Dashboard() {
  const navigate = useNavigate();
  const [view, setView] = useState("Affordable & Growing");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<"success" | "error" | null>(null);
  const apiConfigured = Boolean(import.meta.env.VITE_API_URL?.trim());
  const [payload, setPayload] = useState(emptyDashboardPayload);
  const [dashboardLoading, setDashboardLoading] = useState(apiConfigured);
  const [dashboardUnavailable, setDashboardUnavailable] = useState(!apiConfigured);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [selectedSectors, setSelectedSectors] = useState<string[]>(() => getCachedPreferences()?.sectors ?? []);
  const [preferencesLoading, setPreferencesLoading] = useState(() => (
    isAuthApiConfigured() && Boolean(getSessionToken()) && !getCachedPreferences()?.sectors.length
  ));
  const { isWatched, add, loading: watchlistLoading } = useWatchlist();
  const bucket: DashboardBucket = view === "Popular & Stable" ? "popular_stable" : "affordable_growing";
  const sections = getDashboardSections(payload, selectedSectors, bucket);
  const toggleSection = (sectionKey: string) => {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  };
  useEffect(() => {
    const controller = new AbortController();
    loadDashboardPayload(controller.signal).then((nextPayload) => {
      setPayload(nextPayload);
      setDashboardUnavailable(!apiConfigured);
      setDashboardLoading(false);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (apiConfigured) {
        setPayload(emptyDashboardPayload);
        setDashboardUnavailable(true);
      }
      setDashboardLoading(false);
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
      if (cachedPreferences?.sectors.length) setSelectedSectors(cachedPreferences.sectors);
      else setPreferencesLoading(true);
      getPreferences().then((preferences) => {
        setSelectedSectors(preferences.sectors);
      }).catch(() => {
        if (!cachedPreferences?.sectors.length) setSelectedSectors([]);
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
    <div className="market-toolbar"><div className={`market-status ${marketStatus ? (marketStatus.is_open ? "market-status-open" : "market-status-closed") : ""}`} aria-live="polite"><span><span className="market-status-dot" aria-hidden="true" /> {marketStatus?.label ?? "—"} · {marketStatus?.exchange ?? "—"}</span>{marketStatus && <small>Next open: {formatNextMarketOpen(marketStatus.next_open)} · {marketStatus.note}</small>}</div></div>
    {preferencesLoading ? <div className="market-sections" role="status" aria-label="Loading your selected sectors">{[0, 1, 2].map((key) => <section className="market-section market-skeleton-section" key={key}><div className="market-section-heading"><span className="loading-bar loading-sector" /><span className="loading-bar loading-action" /></div>{[0, 1, 2].map((row) => <div className="market-skeleton-row" key={row}><span className="loading-bar loading-company" /><span className="loading-bar loading-metric" /><span className="loading-bar loading-metric" /><span className="loading-bar loading-action" /></div>)}</section>)}</div> : selectedSectors.length === 0 ? <p className="auth-muted-line" role="status">No sectors selected. Choose sectors in setup to see companies here.</p> : <div className="market-sections">{sections.map((section) => {
      const sectionKey = `${bucket}:${section.name}`;
      const isExpanded = expandedSections.has(sectionKey);
      const visibleItems = isExpanded ? section.items : section.items.slice(0, 10);
      const hasMoreItems = section.items.length > 10;
      return <section className="market-section" key={section.name}>
        <div className="market-section-heading">
          <span className="sector-pill">{section.name}</span>
          <button className="view-all" type="button" aria-expanded={isExpanded} disabled={!hasMoreItems} onClick={() => toggleSection(sectionKey)}>{isExpanded ? "Show less ↑" : "View all →"}</button>
        </div>
        <div className="table-wrap"><table className="market-table" aria-busy={dashboardLoading}>
          <colgroup><col className="market-company-column" /><col className="market-signal-column" /><col className="market-price-column" /><col className="market-action-column" /></colgroup>
          <thead><tr><th>Company / ticker</th><th>Signal status</th><th>Price</th><th>Action</th></tr></thead>
          <tbody>{section.items.length === 0 ? dashboardLoading ? [0, 1, 2].map((key) => <tr className="market-skeleton-row" key={key} aria-hidden="true"><td><span className="loading-bar loading-company" /><span className="loading-bar loading-subline" /></td><td><span className="loading-bar loading-metric" /></td><td><span className="loading-bar loading-metric" /></td><td><span className="loading-bar loading-action" /></td></tr>) : <tr><td><strong>—</strong><small>No companies in this sector right now</small></td><td>—</td><td>—</td><td><span className="watch-placeholder" aria-hidden="true" /></td></tr> : visibleItems.map((company) => {
            const signal = getSignalStatus(company);
            return <tr className="market-company-row" key={company.ticker} onClick={() => navigate(`/company/${encodeURIComponent(company.ticker)}`)}>
              <td><button className="market-company-link" type="button" onClick={() => navigate(`/company/${encodeURIComponent(company.ticker)}`)} aria-label={`View ${company.name} (${company.ticker}) details`}><strong>{company.name}</strong><small>{company.ticker}</small></button></td>
              <td><span className={signal === "neutral" ? "signal-neutral" : signal === "down" ? "signal-down" : "signal-up"}>{signal === "neutral" ? "—" : signal === "down" ? "↓" : "↑"}</span></td>
              <td>{company.price}</td>
              <td><span className="watch-action">{watchlistLoading || isWatched(company.ticker) ? <span className="watch-placeholder" aria-hidden="true" /> : <button className="watch-button" onClick={(event) => { event.stopPropagation(); add(company.ticker); setToast("success"); }}>＋ Watchlist</button>}</span></td>
            </tr>;
          })}</tbody>
        </table></div>
        {dashboardUnavailable && <p className="auth-muted-line" role="status">Backend data will appear here when the API is available.</p>}
      </section>;
    })}</div>}
    {toast && <Toast type={toast} message="Successfully added to your Watchlist" onDone={() => setToast(null)} />}
  </AppShell>;
}
