/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type WatchlistContextValue = { isWatched: (ticker: string) => boolean; add: (ticker: string) => void; remove: (ticker: string) => void };
const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [tickers, setTickers] = useState<string[]>(() => {
    const saved = window.localStorage.getItem("perennial-watchlist-v2");
    return saved ? JSON.parse(saved) as string[] : [];
  });
  useEffect(() => { window.localStorage.setItem("perennial-watchlist-v2", JSON.stringify(tickers)); }, [tickers]);
  const value = { isWatched: (ticker: string) => tickers.includes(ticker), add: (ticker: string) => setTickers((current) => current.includes(ticker) ? current : [...current, ticker]), remove: (ticker: string) => setTickers((current) => current.filter((item) => item !== ticker)) };
  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error("useWatchlist must be used inside WatchlistProvider");
  return context;
}
