import { useEffect, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";

type IconName = "dashboard" | "watchlist" | "insight" | "setting" | "logout";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactElement> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    watchlist: <path d="m12 20-1.7-1.55C5.3 13.9 2 10.9 2 7.25A4.75 4.75 0 0 1 6.75 2.5c1.7 0 3.35.8 4.25 2.1.9-1.3 2.55-2.1 4.25-2.1A4.75 4.75 0 0 1 20 7.25c0 3.65-3.3 6.65-8.3 11.2L12 20Z" />,
    insight: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 3-4 3 2 5-7" /></>,
    setting: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 0 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 3.7 11H3.5a2 2 0 0 1 0-4h.2a2 2 0 0 0 1.4-3.4L5 3.5a2 2 0 1 1 2.8-2.8l.1.1A2 2 0 0 0 11.3 2h.2a2 2 0 0 1 4 0v.2a2 2 0 0 0 3.4 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 20.3 10h.2a2 2 0 0 1 0 4h-.2a2 2 0 0 0-.9 1Z" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 19V5a2 2 0 0 0-2-2h-5" /></>,
  };
  return <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const navItems = [["dashboard", "Dashboard", "/"], ["watchlist", "Watchlist", "/watchlist"], ["insight", "Insight", "/insights"], ["setting", "Setting", "/settings"]] as const;

export function PerennialLogo() {
  return <div className="perennial-logo"><img src="/perennial-logo.svg" alt="" aria-hidden="true" /><span>PERENNIAL</span></div>;
}

type AppShellProps = { children: ReactNode; title: string; subtitle?: string; headerActions?: ReactNode };

export default function AppShell({ children, title, subtitle, headerActions }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand" onClick={() => navigate("/")} role="button" tabIndex={0}><PerennialLogo /></div>
        <div className="sidebar-label">Explore</div>
        <nav className="sidebar-nav">{navItems.map(([icon, label, path]) => <NavLink key={path} to={path} end={path === "/"} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}><span className="nav-icon"><Icon name={icon} /></span>{label}</NavLink>)}</nav>
        <div className="sidebar-footer"><button className="nav-link sidebar-logout" onClick={() => navigate("/login")}><span className="nav-icon"><Icon name="logout" /></span>Logout</button></div>
      </aside>
      {open && <button className="mobile-overlay" onClick={() => setOpen(false)} aria-label="Close menu" />}
      <main className="main-area">
        <header className="topbar"><button className="menu-button" onClick={() => setOpen(true)} aria-label="Open menu">☰</button><div className="topbar-actions"><button className="search-box" onClick={() => navigate("/watchlist")}><span>⌕</span><span>Search stocks, tickers, events (e.g. NVDA, RBLX)...</span></button><button className="profile-chip" onClick={() => navigate("/profile")}><span className="profile-avatar">AL</span><span className="profile-copy"><strong>Alexander Lane</strong><small>Verified Investor</small></span><span className="profile-chevron">⌄</span></button></div></header>
        <div className="page-content"><div className="page-heading"><div className="page-heading-copy"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{headerActions}</div>{children}</div>
      </main>
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) { return <div className="auth-shell"><div className="auth-brand"><PerennialLogo /></div>{children}<p className="auth-footer">© 2026 Perennial · Built for better-informed decisions</p></div>; }

export function ScoreRing({ score }: { score: number }) { return <div className="score-ring" style={{ "--score": `${score * 3.6}deg` } as CSSProperties}><div><strong>{score}</strong><span>/ 100</span></div></div>; }

export function CompanyBadge({ company }: { company: { name: string; ticker: string } }) { return <div className="company-badge"><span className={`company-logo logo-${company.ticker.toLowerCase()}`}>{company.ticker.slice(0, 1)}</span><span><strong>{company.name}</strong><small>{company.ticker}</small></span></div>; }

export function TrashIcon() {
  return <svg className="trash-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></svg>;
}

export function Toast({ type, message, onDone }: { type: "success" | "error"; message: string; onDone: () => void }) {
  useEffect(() => { const timer = window.setTimeout(onDone, 3600); return () => window.clearTimeout(timer); }, [onDone]);
  return <div className={`toast toast-${type}`} role="status"><span className="toast-icon">{type === "success" ? "✓" : "!"}</span><strong>{message}</strong></div>;
}
