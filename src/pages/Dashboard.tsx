import { useEffect, useState } from "react";
import AppShell, { Toast } from "../components/AppShell";
import { useWatchlist } from "../components/watchlistStore";
import { getSignalStatus } from "../data";
import { dashboardPayload, getDashboardSections, type DashboardBucket } from "../dashboardData";
import { loadDashboardPayload } from "../api/dashboard";
import { getPreferences, getSessionToken, isAuthApiConfigured } from "../api/auth";
import { getMarketStatus } from "../marketStatus";

export default function Dashboard() {
  const [view, setView] = useState("Affordable & Growing");
  const [toast, setToast] = useState<"success" | "error" | null>(null);
  const [payload, setPayload] = useState(dashboardPayload);
  const [marketStatus, setMarketStatus] = useState(() => getMarketStatus());
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const { isWatched, add } = useWatchlist();
  const bucket: DashboardBucket = view === "Popular & Stable" ? "popular_stable" : "affordable_growing";
  const sections = getDashboardSections(payload, selectedSectors, bucket);
  useEffect(() => {
    const controller = new AbortController();
    loadDashboardPayload(controller.signal).then(setPayload).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setPayload(dashboardPayload);
    });
    const loadPreferences = () => {
      if (!isAuthApiConfigured() || !getSessionToken()) {
        setSelectedSectors([]);
        return;
      }
      getPreferences().then((preferences) => setSelectedSectors(preferences.sectors)).catch(() => setSelectedSectors([]));
    };
    loadPreferences();
    window.addEventListener("perennial-auth-changed", loadPreferences);
    const timer = window.setInterval(() => setMarketStatus(getMarketStatus()), 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("perennial-auth-changed", loadPreferences);
    };
  }, []);
  return <AppShell title="Market Health" subtitle="Curated market opportunities and sector trend monitors." headerActions={<div className="segmented"><button className={view === "Affordable & Growing" ? "selected" : ""} onClick={() => setView("Affordable & Growing")}>Affordable &amp; Growing</button><button className={view === "Popular & Stable" ? "selected" : ""} onClick={() => setView("Popular & Stable")}>Popular &amp; Stable</button></div>}>
    <div className="market-toolbar"><span className={`market-status ${marketStatus.isOpen ? "market-status-open" : "market-status-closed"}`} aria-live="polite"><span className="market-status-dot" aria-hidden="true" />{marketStatus.label} · {marketStatus.exchange}</span></div>
    <div className="market-sections">{sections.map((section) => <section className="market-section" key={section.name}><div className="market-section-heading"><span className="sector-pill">{section.name}</span><button className="view-all">View all →</button></div><div className="table-wrap"><table className="market-table"><colgroup><col className="market-company-column" /><col className="market-signal-column" /><col className="market-price-column" /><col className="market-action-column" /></colgroup><thead><tr><th>Company / ticker</th><th>Signal status</th><th>Price</th><th>Action</th></tr></thead><tbody>{section.items.map((company) => { const signal = getSignalStatus(company); return <tr key={company.ticker}><td><strong>{company.name}</strong><small>{company.ticker}</small></td><td><span className={signal === "neutral" ? "signal-neutral" : signal === "down" ? "signal-down" : "signal-up"}>{signal === "neutral" ? "—" : signal === "down" ? "↓" : "↑"}</span></td><td>{company.price}</td><td><span className="watch-action">{isWatched(company.ticker) ? <span className="watch-placeholder" aria-hidden="true" /> : <button className="watch-button" onClick={() => { add(company.ticker); setToast("success"); }}>＋ Watchlist</button>}</span></td></tr>; })}</tbody></table></div></section>)}</div>
    {toast && <Toast type={toast} message="Successfully added to your Watchlist" onDone={() => setToast(null)} />}
  </AppShell>;
}
