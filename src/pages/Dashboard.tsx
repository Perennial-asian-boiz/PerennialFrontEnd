import { useState } from "react";
import AppShell, { Toast } from "../components/AppShell";
import { useWatchlist } from "../components/watchlistStore";
import { companies } from "../data";

const sectionNames = ["Technology", "Healthcare", "Consumer Staples"];
const sections = sectionNames.map((name) => ({ name, items: companies.filter((company) => company.sector === name) }));

export default function Dashboard() {
  const [view, setView] = useState("Popular & Stable");
  const [toast, setToast] = useState<"success" | "error" | null>(null);
  const { isWatched, add } = useWatchlist();
  return <AppShell title="Market Health" subtitle="Curated market opportunities and sector trend monitors." headerActions={<div className="segmented"><button className={view === "Affordable & Growing" ? "selected" : ""} onClick={() => setView("Affordable & Growing")}>Affordable &amp; Growing</button><button className={view === "Popular & Stable" ? "selected" : ""} onClick={() => setView("Popular & Stable")}>Popular &amp; Stable</button></div>}>
    <div className="market-toolbar"><span className="market-status">● Market Open · NYSE</span></div>
    <div className="market-sections">{sections.map((section) => <section className="market-section" key={section.name}><div className="market-section-heading"><span className="sector-pill">{section.name}</span><button className="view-all">View all →</button></div><div className="table-wrap"><table className="market-table"><colgroup><col className="market-company-column" /><col className="market-signal-column" /><col className="market-price-column" /><col className="market-action-column" /></colgroup><thead><tr><th>Company / ticker</th><th>Signal status</th><th>Price</th><th>Action</th></tr></thead><tbody>{section.items.map((company) => { const signal = company.change.startsWith("-") ? "down" : company.sentiment === "Neutral" ? "neutral" : "up"; return <tr key={company.ticker}><td><strong>{company.name}</strong><small>{company.ticker}</small></td><td><span className={signal === "neutral" ? "signal-neutral" : signal === "down" ? "signal-down" : "signal-up"}>{signal === "neutral" ? "—" : signal === "down" ? "↓" : "↑"}</span></td><td>{company.price}</td><td><span className="watch-action">{isWatched(company.ticker) ? <span className="watch-placeholder" aria-hidden="true" /> : <button className="watch-button" onClick={() => { add(company.ticker); setToast("success"); }}>＋ Watchlist</button>}</span></td></tr>; })}</tbody></table></div></section>)}</div>
    {toast && <Toast type={toast} message="Successfully added to your Watchlist" onDone={() => setToast(null)} />}
  </AppShell>;
}
