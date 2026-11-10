import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { COMPANY_SEARCH_PAGE_SIZE, searchCompanies, type CompanySearchResult } from "../api/companySearch";

type SearchState = {
  query: string;
  results: CompanySearchResult[];
  offset: number;
  hasMore: boolean;
  loading: boolean;
  error: boolean;
};

const emptyState: SearchState = { query: "", results: [], offset: 0, hasMore: false, loading: false, error: false };

export default function CompanySearch({ isWatched }: { isWatched: (ticker: string) => boolean }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [state, setState] = useState(emptyState);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const navigate = useNavigate();
  const trimmedQuery = query.trim();
  const current = state.query === trimmedQuery;
  const results = current ? state.results : [];
  const loading = !current || state.loading || state.offset !== offset;
  const error = current && state.error;
  const expanded = open && Boolean(trimmedQuery);

  useEffect(() => {
    if (!trimmedQuery) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState((previous) => ({
        ...(previous.query === trimmedQuery ? previous : emptyState),
        query: trimmedQuery, loading: true, error: false,
      }));
      searchCompanies(trimmedQuery, offset, controller.signal).then((page) => {
        if (controller.signal.aborted) return;
        setState((previous) => {
          const existing = offset > 0 && previous.query === trimmedQuery ? previous.results : [];
          const seen = new Set(existing.map((company) => company.symbol));
          return {
            query: trimmedQuery,
            results: [...existing, ...page.results.filter((company) => !seen.has(company.symbol))],
            offset, hasMore: page.has_more, loading: false, error: false,
          };
        });
      }).catch(() => {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          ...(previous.query === trimmedQuery ? previous : emptyState),
          query: trimmedQuery, offset, loading: false, error: true,
        }));
      });
    }, offset === 0 ? 200 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [trimmedQuery, offset, attempt]);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  useEffect(() => {
    if (expanded && activeIndex >= 0) {
      listRef.current?.querySelector(`[data-search-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, expanded]);

  function select(company: CompanySearchResult) {
    setQuery(company.symbol);
    setOffset(0);
    setActiveIndex(-1);
    setOpen(false);
    navigate(`/company/${encodeURIComponent(company.symbol)}`);
  }

  function loadMore() {
    if (current && state.hasMore && !loading && !error) setOffset(state.offset + COMPANY_SEARCH_PAGE_SIZE);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (results.length > 0) setActiveIndex((index) => event.key === "ArrowDown"
        ? Math.min(index + 1, results.length - 1)
        : (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter" && expanded && results[activeIndex]) {
      event.preventDefault();
      select(results[activeIndex]);
    }
  }

  return <div className="search-box" ref={boxRef} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <svg className="search-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
    <input role="combobox" aria-label="Search companies or tickers" aria-autocomplete="list"
      aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
      aria-activedescendant={expanded && results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
      value={query} maxLength={100} autoComplete="off"
      onFocus={() => setOpen(true)} onKeyDown={handleKeyDown}
      onChange={(event) => {
        setQuery(event.target.value); setOffset(0); setActiveIndex(-1); setOpen(true);
        if (listRef.current) listRef.current.scrollTop = 0;
      }} placeholder="Search companies or tickers (e.g. NVDA, RBLX)…" />
    {expanded && <div className="search-results" ref={listRef} onScroll={(event) => {
      const list = event.currentTarget;
      if (list.scrollHeight - list.scrollTop - list.clientHeight < 48) loadMore();
    }}>
      <div role="listbox" id={listId} aria-label="Matching companies" aria-busy={loading}>
        {results.map((company, index) => <div role="option" aria-selected={activeIndex === index}
          id={`${listId}-${index}`} data-search-index={index}
          className={`search-result${activeIndex === index ? " search-result-active" : ""}`}
          key={company.symbol} onMouseDown={(event) => event.preventDefault()} onClick={() => select(company)}>
          <div className="search-result-main"><strong>{company.name || company.symbol}</strong>
            <span>{company.symbol}{company.sector ? ` · ${company.sector}` : ""}</span></div>
          {isWatched(company.symbol) && <span className="search-watched">In Watchlist</span>}
        </div>)}
      </div>
      {loading && <div className="search-empty" role="status">{results.length ? "Loading more companies…" : "Searching companies…"}</div>}
      {error && <div className="search-empty" role="status">Could not load companies. <button type="button" className="search-retry" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div>}
      {!loading && !error && results.length === 0 && <div className="search-empty" role="status">No companies found.</div>}
      {!loading && !error && current && state.hasMore && <button className="search-load-more" type="button" onClick={loadMore}>Load more companies</button>}
    </div>}
  </div>;
}
