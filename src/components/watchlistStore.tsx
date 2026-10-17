/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { addToWatchlist, getSessionToken, getWatchlist, isAuthApiConfigured, removeFromWatchlist } from "../api/auth";

type WatchlistContextValue = { isWatched: (ticker: string) => boolean; add: (ticker: string) => void; remove: (ticker: string) => void };
const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [tickers, setTickers] = useState<string[]>([]);

  useEffect(() => {
    const loadWatchlist = () => {
      if (!isAuthApiConfigured() || !getSessionToken()) {
        setTickers([]);
        return;
      }
      getWatchlist().then((items) => setTickers(items.map((item) => item.ticker))).catch(() => setTickers([]));
    };
    loadWatchlist();
    window.addEventListener("perennial-auth-changed", loadWatchlist);
    return () => window.removeEventListener("perennial-auth-changed", loadWatchlist);
  }, []);

  const value = {
    isWatched: (ticker: string) => tickers.includes(ticker),
    add: (ticker: string) => {
      if (tickers.includes(ticker)) return;
      setTickers((current) => [...current, ticker]);
      if (isAuthApiConfigured() && getSessionToken()) {
        void addToWatchlist(ticker).catch(() => setTickers((current) => current.filter((item) => item !== ticker)));
      }
    },
    remove: (ticker: string) => {
      setTickers((current) => current.filter((item) => item !== ticker));
      if (isAuthApiConfigured() && getSessionToken()) {
        void removeFromWatchlist(ticker).catch(() => setTickers((current) => current.includes(ticker) ? current : [...current, ticker]));
      }
    },
  };
  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error("useWatchlist must be used inside WatchlistProvider");
  return context;
}
