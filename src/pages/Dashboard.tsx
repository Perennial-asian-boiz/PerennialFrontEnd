import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";

const sections = [
  { name: "Technology", items: [["Microsoft", "MSFT", "$496.03", "up"], ["Apple", "AAPL", "$233.27", "neutral"], ["NVIDIA", "NVDA", "$214.17", "up"]] },
  { name: "Healthcare", items: [["Eli Lilly", "LLY", "$626.50", "down"], ["Vertex", "VRTX", "$527.12", "up"], ["GSK", "GSK", "$143.93", "down"]] },
  { name: "Consumer Staples", items: [["Kraft Heinz", "KHC", "$37.72", "up"], ["Keurig Dr Pepper", "KDP", "$31.61", "neutral"], ["General Mills", "GIS", "$48.13", "down"]] },
];

export default function Dashboard() {
  const [view, setView] = useState("Popular & Stable");
  const navigate = useNavigate();
  return <AppShell title="Market Health" subtitle="Curated market opportunities and sector trend monitors.">
    <div className="market-toolbar"><span className="market-status">● Market Open · NYSE</span><div className="segmented"><button className={view === "Affordable & Growing" ? "selected" : ""} onClick={() => setView("Affordable & Growing")}>Affordable &amp; Growing</button><button className={view === "Popular & Stable" ? "selected" : ""} onClick={() => setView("Popular & Stable")}>Popular &amp; Stable</button></div></div>
    <div className="market-sections">{sections.map((section) => <section className="market-section" key={section.name}><div className="market-section-heading"><span className="sector-pill">{section.name}</span><button className="view-all">View all →</button></div><div className="table-wrap"><table className="market-table"><thead><tr><th>Company / ticker</th><th>Signal status</th><th>Price</th><th>Action</th></tr></thead><tbody>{section.items.map(([name, ticker, price, signal]) => <tr key={ticker}><td><strong>{name}</strong><small>{ticker}</small></td><td><span className={signal === "neutral" ? "signal-neutral" : signal === "down" ? "signal-down" : "signal-up"}>{signal === "neutral" ? "—" : signal === "down" ? "↓" : "↑"}</span></td><td>{price}</td><td><button className="watch-button" onClick={() => navigate("/watchlist")}>＋ Watchlist</button></td></tr>)}</tbody></table></div></section>)}</div>
  </AppShell>;
}
