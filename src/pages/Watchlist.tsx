import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell, { CompanyBadge, Toast, TrashIcon, type ToastAction } from "../components/AppShell";
import { useWatchlist } from "../components/watchlistStore";
import { getSignalStatus, type Company } from "../data";
import { loadDashboardPayload } from "../api/dashboard";
import { loadSecurityDetails } from "../api/company";
import { UNDO_WINDOW_MS, restoreAll, undoable, withUndoable, type UndoableRemoval } from "../lib/watchlistRemoval";

import "./Watchlist.css";

function dashboardSectorLabel(sector: string | null): string {
  const label = sector?.trim();
  if (!label) return "—";

  const dashboardLabels: Record<string, string> = {
    "basic materials": "Materials",
    "consumer cyclical": "Consumer Discretionary",
    "consumer defensive": "Consumer Staples",
    "financial services": "Financials",
    "information technology": "Technology",
  };
  return dashboardLabels[label.toLowerCase()] ?? label;
}

// `id` remounts the toast, so each one gets its own full timer.
type WatchlistToast = { id: number; type: "success" | "error"; message: string; undo?: boolean };

const named = (tickers: string[]) => tickers.length === 1 ? tickers[0] : `${tickers.length} tickers`;

export default function Watchlist() {
  const navigate = useNavigate();
  const [toast, setToast] = useState<WatchlistToast | null>(null);
  // A ref, not state: two removals can be in flight at once, and each must add to the
  // list the other left, not to the list as it was when its own row was clicked.
  const recentRemovals = useRef<UndoableRemoval[]>([]);
  const { tickers, loading: watchlistLoading, remove, restore, isRemoving } = useWatchlist();
  const [dashboardCompanies, setDashboardCompanies] = useState<Company[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [companyProfiles, setCompanyProfiles] = useState<Record<string, { name: string; sector: string }>>({});

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

  const dashboardTickers = useMemo(
    () => new Set(dashboardCompanies.map((company) => company.ticker)),
    [dashboardCompanies],
  );
  const missingProfileTickers = useMemo(
    () => [...new Set(tickers)].filter(
      (ticker) => !dashboardTickers.has(ticker) && !companyProfiles[ticker],
    ),
    [companyProfiles, dashboardTickers, tickers],
  );
  const profileLoading = !dataLoading && missingProfileTickers.length > 0;

  useEffect(() => {
    if (dataLoading) return;

    if (missingProfileTickers.length === 0) return;

    const controller = new AbortController();
    Promise.all(missingProfileTickers.map(async (ticker) => {
      try {
        const security = await loadSecurityDetails(ticker, controller.signal);
        return [ticker, {
          name: security.name?.trim() || ticker,
          sector: dashboardSectorLabel(security.sector),
        }] as const;
      } catch {
        return [ticker, { name: ticker, sector: "—" }] as const;
      }
    })).then((profiles) => {
      if (!controller.signal.aborted) {
        setCompanyProfiles((current) => ({ ...current, ...Object.fromEntries(profiles) }));
      }
    });

    return () => controller.abort();
  }, [dataLoading, missingProfileTickers]);

  const filtered = useMemo(() => {
    const byTicker = new Map(dashboardCompanies.map((company) => [company.ticker, company]));
    return tickers.map((ticker) => byTicker.get(ticker) ?? {
      name: companyProfiles[ticker]?.name ?? ticker,
      ticker,
      sector: companyProfiles[ticker]?.sector ?? "—",
      price: "—",
      score: 0,
      change: "—",
      sentiment: "Neutral" as const,
      reason: "This ticker is not in the current dashboard publication.",
    });
  }, [companyProfiles, dashboardCompanies, tickers]);

  const showToast = (next: Omit<WatchlistToast, "id">) => setToast((current) => ({ ...next, id: (current?.id ?? 0) + 1 }));
  const dismissToast = useCallback(() => setToast(null), []);

  // S3-06. The row leaves only after DELETE succeeds (AC 1); if the call fails it
  // stays and an error is shown (AC 5). "Undo" is offered for UNDO_WINDOW_MS after
  // each removal (AC 2); one Undo restores every removal still inside its own window.
  const removeCompany = (ticker: string) => {
    if (isRemoving(ticker)) return;
    remove(ticker).then(
      (removal) => {
        const live = withUndoable(recentRemovals.current, removal, Date.now());
        recentRemovals.current = live;
        showToast({ type: "success", message: `Removed ${named(live.map((entry) => entry.removal.ticker))} from your Watchlist`, undo: true });
      },
      () => showToast({ type: "error", message: `Couldn't remove ${ticker}. It is still on your Watchlist.` }),
    );
  };
  const undoRemovals = () => {
    const live = undoable(recentRemovals.current, Date.now());
    recentRemovals.current = [];
    setToast(null);
    void restoreAll(live, restore).then(({ restored, failed }) => {
      if (failed.length) showToast({ type: "error", message: `Couldn't restore ${failed.join(", ")}. Please add ${failed.length === 1 ? "it" : "them"} again.` });
      else if (restored.length) showToast({ type: "success", message: `Restored ${named(restored)} to your Watchlist` });
    });
  };
  const toastAction: ToastAction | undefined = toast?.undo ? { label: "Undo", onAction: undoRemovals } : undefined;

  return <AppShell className="watchlist-shell" title="Your Watchlist" subtitle="Active items tracked for analysis.">
    <div className="watchlist-toolbar"><span className="asset-pill">All Assets</span><span className="watchlist-count">{filtered.length} companies</span></div>
    <div className="panel">
      {watchlistLoading || ((dataLoading || profileLoading) && filtered.length > 0) ? <div className="watchlist-skeleton-list" role="status" aria-label="Loading your saved companies"><div className="watchlist-skeleton-row watchlist-skeleton-header">{[0, 1, 2, 3, 4, 5, 6].map((cell) => <span className="loading-bar watchlist-skeleton-cell" key={cell} />)}</div>{[0, 1, 2].map((row) => <div className="watchlist-skeleton-row" key={row}><span className="loading-bar watchlist-skeleton-company" /><span className="loading-bar watchlist-skeleton-cell" /><span className="loading-bar watchlist-skeleton-cell" /><span className="loading-bar watchlist-skeleton-cell" /><span className="loading-bar watchlist-skeleton-cell" /><span className="loading-bar watchlist-skeleton-cell" /><span className="loading-bar watchlist-skeleton-action" /></div>)}</div> : filtered.length === 0 ? <div className="empty-state"><div className="empty-state-icon">♡</div><h2>Your watchlist is empty</h2><p>Add companies from Market Health and they will appear here.</p><button className="btn-primary" onClick={() => window.location.assign("/")}>Explore Market Health</button></div> : <div className="table-wrap"><table className="data-table watchlist-table"><colgroup><col className="watchlist-company-column" /><col className="watchlist-sector-column" /><col className="watchlist-sentiment-column" /><col className="watchlist-confidence-column" /><col className="watchlist-signal-column" /><col className="watchlist-price-column" /><col className="watchlist-action-column" /></colgroup><thead><tr><th>Company name</th><th>Sector</th><th>Sentiment pulse</th><th>Confidence</th><th>Signal status</th><th>Current price</th><th /></tr></thead><tbody>{filtered.map((company) => { const signal = getSignalStatus(company); const removing = isRemoving(company.ticker); return <tr className={`watchlist-company-row${removing ? " watchlist-row-removing" : ""}`} aria-busy={removing} key={company.ticker} onClick={() => navigate(`/company/${encodeURIComponent(company.ticker)}`)}><td><button className="watchlist-company-link" type="button" onClick={() => navigate(`/company/${encodeURIComponent(company.ticker)}`)} aria-label={`View ${company.name} (${company.ticker}) details`}><CompanyBadge company={company}/></button></td><td><span className="sector-text">{company.sector}</span></td><td><span className={`tag ${company.sentiment === "Neutral" ? "tag-neutral" : company.sentiment === "Watch" ? "tag-watch" : ""}`}>● {company.sentiment}</span></td><td><strong>{company.score || "—"}</strong></td><td><span className={signal === "neutral" ? "signal-neutral" : signal === "down" ? "signal-down" : "signal-up"}>{signal === "neutral" ? "—" : signal === "down" ? "↓" : "↑"}</span></td><td><strong>{company.price}</strong><small className={company.change.startsWith("+") ? "metric-positive" : company.change.startsWith("-") ? "metric-negative" : ""}>{company.change}</small></td><td><button className="trash-button" type="button" disabled={removing} onClick={(event) => { event.stopPropagation(); removeCompany(company.ticker); }} aria-label={`Remove ${company.name} from watchlist`}><TrashIcon /></button></td></tr>; })}</tbody></table></div>}
      {!dataLoading && filtered.some((company) => company.price === "—") && filtered.length > 0 && <p className="end-of-list" role="status">Some saved tickers are not in the current dashboard data, so their price is unavailable.</p>}
      {!watchlistLoading && !((dataLoading || profileLoading) && filtered.length > 0) && <p className="end-of-list">{filtered.length ? "End of watchlist" : "Your saved companies will appear here"}</p>}
    </div>
    {toast && <Toast key={toast.id} type={toast.type} message={toast.message} onDone={dismissToast} duration={toast.undo ? UNDO_WINDOW_MS : undefined} action={toastAction} />}
  </AppShell>;
}
