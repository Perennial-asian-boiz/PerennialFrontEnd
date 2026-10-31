import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadSecurityDetails, type SecurityDetails } from "../api/company";
import AppShell, { Toast } from "../components/AppShell";
import { useWatchlist } from "../components/watchlistStore";

export default function Company() {
  const navigate = useNavigate();
  const { symbol: routeSymbol } = useParams<{ symbol: string }>();
  const symbol = routeSymbol?.trim().toUpperCase() ?? "";
  const [result, setResult] = useState<{ symbol: string; security: SecurityDetails | null; error: string }>({
    symbol: "",
    security: null,
    error: "",
  });
  const [toast, setToast] = useState<"success" | null>(null);
  const { isWatched, add } = useWatchlist();

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
    else navigate("/");
  };

  return <AppShell title="Company details" subtitle="Company information from the Perennial API." hidePageHeading>
    <div className="company-detail-topline">
      <button className="company-back-button" type="button" onClick={goBack}>Back</button>
      <span className="company-detail-divider" aria-hidden="true" />
      <div className="company-detail-identity">
        <h1>{security ? name : symbol || "Company details"}</h1>
        {security && <><span className="company-detail-chip">{security.symbol}</span><span className="company-detail-chip company-detail-sector">{security.sector ?? "Sector unavailable"}</span></>}
      </div>
      {security && !isWatched(security.symbol) && <button className="btn-primary company-detail-watch" onClick={() => { add(security.symbol); setToast("success"); }}>＋ Add to watchlist</button>}
    </div>
    {!symbol ? <p className="auth-muted-line" role="status">Search for a company to view its details.</p> : loading ? <p className="auth-muted-line" role="status">Loading company details…</p> : error ? <p className="auth-error" role="alert">{error}</p> : security && <>
      <div className="section-heading"><h2>Company summary</h2></div>
      <div className="panel">
        {security.summary ? <>
          <p className="company-summary-text">{security.summary.text}</p>
          <a className="company-summary-source" href={security.summary.source.url} target="_blank" rel="noreferrer">Source: {security.summary.source.name}</a>
        </> : <p className="auth-muted-line" role="status">Summary not available</p>}
      </div>
    </>}
    {toast && <Toast type="success" message="Successfully added to your Watchlist" onDone={() => setToast(null)} />}
  </AppShell>;
}
