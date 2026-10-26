import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AppShell, { Toast } from "../components/AppShell";
import { useWatchlist } from "../components/watchlistStore";
import { loadSecurity, SecurityNotFoundError, type Security } from "../api/securities";

type LoadState = { status: "ready"; security: Security } | { status: "not-found" } | { status: "error" };

/** S1-12: name, ticker, sector and a brief summary from GET /v1/securities/{symbol}. */
export default function CompanySummary() {
  const { symbol = "" } = useParams();
  const [loaded, setLoaded] = useState<{ symbol: string; state: LoadState } | null>(null);
  const state: LoadState | { status: "loading" } = loaded && loaded.symbol === symbol ? loaded.state : { status: "loading" };
  const [toast, setToast] = useState<"success" | "error" | null>(null);
  const { isWatched, add } = useWatchlist();

  useEffect(() => {
    const controller = new AbortController();
    loadSecurity(symbol, controller.signal)
      .then((security) => setLoaded({ symbol, state: { status: "ready", security } }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoaded({ symbol, state: { status: error instanceof SecurityNotFoundError ? "not-found" : "error" } });
      });
    return () => controller.abort();
  }, [symbol]);

  if (state.status !== "ready") {
    const message = state.status === "loading" ? "Loading company…"
      : state.status === "not-found" ? `No company found for "${symbol.toUpperCase()}".`
        : "Company details are unavailable right now. Please try again.";
    return <AppShell title="Company details" subtitle="What the company does, in brief."><div className="panel"><p role={state.status === "loading" ? "status" : "alert"} style={{ margin: 0 }}>{message}</p></div></AppShell>;
  }

  const { security } = state;
  const name = security.name ?? security.symbol;
  return <AppShell title="Company details" subtitle="What the company does, in brief.">
    <div className="company-header"><div className="company-title"><div><h2>{name}</h2><p>{security.symbol} · {security.sector ?? "Sector not available"}{security.exchange ? ` · ${security.exchange}` : ""}</p></div></div>{!isWatched(security.symbol) && <button className="btn-primary" onClick={() => { add(security.symbol); setToast("success"); }}>＋ Add to watchlist</button>}</div>
    <div className="section-heading"><h2>About the company</h2></div>
    <div className="panel">
      {security.summary
        ? <><p style={{ margin: 0, lineHeight: 1.6 }}>{security.summary.text}</p><p className="company-summary-source">Source: <a href={security.summary.source.url} target="_blank" rel="noopener noreferrer">{security.summary.source.name}</a></p></>
        : <p style={{ margin: 0 }}>Summary not available</p>}
    </div>
    {toast && <Toast type={toast} message="Successfully added to your Watchlist" onDone={() => setToast(null)} />}
  </AppShell>;
}
