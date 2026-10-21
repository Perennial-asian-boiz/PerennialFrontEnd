import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { allCompanies, type Company } from "../data";
import { dashboardCompanies } from "../dashboardData";
import { clearSession, logout } from "../api/auth";
import { useAuthUser } from "./authUserContext";
import { useWatchlist } from "./watchlistStore";

type IconName = "dashboard" | "watchlist" | "insight" | "setting" | "logout";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactElement> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    watchlist: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    insight: <><path d="m4 16 6-6 4 4 7-7" /><path d="M15 7h6v6" /></>,
    setting: <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 19V5a2 2 0 0 0-2-2h-5" /></>,
  };
  return <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const navItems = [["dashboard", "Dashboard", "/"], ["watchlist", "Watchlist", "/watchlist"], ["insight", "Insight", "/insights"], ["setting", "Setting", "/settings"]] as const;

export function PerennialLogo() {
  return <div className="perennial-logo"><img src="/perennial-logo.svg" alt="" aria-hidden="true" /><span>PERENNIAL</span></div>;
}

function SearchIcon() {
  return <svg className="search-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>;
}

type AppShellProps = { children: ReactNode; title: string; subtitle?: string; headerActions?: ReactNode; hidePageHeading?: boolean; hideSidebarLogout?: boolean };

export default function AppShell({ children, title, subtitle, headerActions, hidePageHeading = false, hideSidebarLogout = false }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = useAuthUser();
  const profileName = user?.full_name.trim() || user?.email || "Account";
  const nameParts = profileName.split(/\s+/);
  const initials = (nameParts.length > 1
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : profileName.slice(0, 2)).toUpperCase();
  const { isWatched, add } = useWatchlist();
  const searchableCompanies = useMemo(() => [...dashboardCompanies, ...allCompanies].filter((company, index, companies) => companies.findIndex((item) => item.ticker === company.ticker) === index), []);
  const searchResults = query.trim() ? searchableCompanies.filter((company) => `${company.name} ${company.ticker} ${company.sector}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const selectSearchResult = (company: Company) => {
    setQuery(company.ticker);
    setIsSearchOpen(false);
    navigate("/");
  };

  const handleLogout = () => {
    void logout().catch(() => undefined).finally(() => {
      clearSession();
      navigate("/login", { replace: true });
    });
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand" onClick={() => navigate("/")} role="button" tabIndex={0}><PerennialLogo /></div>
        <div className="sidebar-label">Explore</div>
        <nav className="sidebar-nav">{navItems.map(([icon, label, path]) => <NavLink key={path} to={path} end={path === "/"} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}><span className="nav-icon"><Icon name={icon} /></span>{label}</NavLink>)}</nav>
        {!hideSidebarLogout && <div className="sidebar-footer"><button className="nav-link sidebar-logout" onClick={handleLogout}><span className="nav-icon"><Icon name="logout" /></span>Logout</button></div>}
      </aside>
      {open && <button className="mobile-overlay" onClick={() => setOpen(false)} aria-label="Close menu" />}
      <main className="main-area">
        <header className="topbar"><button className="menu-button" onClick={() => setOpen(true)} aria-label="Open menu">☰</button><div className="topbar-actions"><div className="search-box" ref={searchBoxRef}><SearchIcon /><input aria-label="Search stocks, tickers, events" value={query} onFocus={() => setIsSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setIsSearchOpen(true); }} placeholder="Search stocks, tickers, events (e.g. NVDA, RBLX)..." />{isSearchOpen && searchResults.length > 0 && <div className="search-results" role="listbox">{searchResults.map((company) => <div className="search-result" key={company.ticker}><button className="search-result-main" type="button" onClick={() => selectSearchResult(company)}><strong>{company.name}</strong><span>{company.ticker} · {company.sector} · {company.price}</span></button>{isWatched(company.ticker) ? <span className="search-watched">In Watchlist</span> : <button className="search-result-action" type="button" onClick={() => add(company.ticker)}>＋ Watchlist</button>}</div>)}</div>}</div><button className="profile-chip" onClick={() => navigate("/profile")}><span className="profile-avatar">{initials}</span><span className="profile-copy"><strong>{profileName}</strong><small>{user?.is_verified ? "Verified Investor" : "Investor"}</small></span><span className="profile-chevron">⌄</span></button></div></header>
        <div className="page-content">{!hidePageHeading && <div className="page-heading"><div className="page-heading-copy"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{headerActions}</div>}{children}</div>
      </main>
    </div>
  );
}

export function AuthShell({ children, className = "" }: { children: ReactNode; className?: string }) { return <div className={`auth-shell ${className}`.trim()}><div className="auth-brand"><PerennialLogo /></div>{children}<p className="auth-footer">© 2026 Perennial · Built for better-informed decisions</p></div>; }

export function ScoreRing({ score }: { score: number }) { return <div className="score-ring" style={{ "--score": `${score * 3.6}deg` } as CSSProperties}><div><strong>{score}</strong><span>/ 100</span></div></div>; }

export function CompanyBadge({ company }: { company: { name: string; ticker: string } }) { return <div className="company-badge"><span className={`company-logo logo-${company.ticker.toLowerCase()}`}>{company.ticker.slice(0, 1)}</span><span><strong>{company.name}</strong><small>{company.ticker}</small></span></div>; }

export function TrashIcon() {
  return <svg className="trash-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></svg>;
}

export function Toast({ type, message, onDone }: { type: "success" | "error"; message: string; onDone: () => void }) {
  useEffect(() => { const timer = window.setTimeout(onDone, 3600); return () => window.clearTimeout(timer); }, [onDone]);
  return <div className={`toast toast-${type}`} role="status"><span className="toast-icon">{type === "success" ? "✓" : "!"}</span><strong>{message}</strong></div>;
}
