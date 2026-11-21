/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { addToWatchlist, getSessionToken, getWatchlist, isAuthApiConfigured, isRecoverySession, removeFromWatchlist } from "../api/auth";
import { removeTicker, restoreTicker, withTickerAt, withoutTicker, type Removal } from "../lib/watchlistRemoval";

type WatchlistContextValue = {
  tickers: string[];
  loading: boolean;
  isWatched: (ticker: string) => boolean;
  add: (ticker: string) => void;
  /** S3-06: resolves once the ticker is removed; rejects, list unchanged, if the API call fails. */
  remove: (ticker: string) => Promise<Removal>;
  /** S3-06 Undo: resolves once the ticker is saved again; rejects, list unchanged, if the API call fails. */
  restore: (removal: Removal) => Promise<void>;
  /** True while a removal's API call is in flight. */
  isRemoving: (ticker: string) => boolean;
};

const hasApiSession = () => isAuthApiConfigured() && Boolean(getSessionToken()) && !isRecoverySession();
const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [tickers, setTickers] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string[]>([]);
  const [loading, setLoading] = useState(() => (
    isAuthApiConfigured() && Boolean(getSessionToken()) && !isRecoverySession()
  ));

  useEffect(() => {
    const loadWatchlist = () => {
      if (!isAuthApiConfigured() || !getSessionToken() || isRecoverySession()) {
        setTickers([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      getWatchlist()
        .then((items) => setTickers(items.map((item) => item.ticker)))
        .catch(() => setTickers([]))
        .finally(() => setLoading(false));
    };
    loadWatchlist();
    window.addEventListener("perennial-auth-changed", loadWatchlist);
    return () => window.removeEventListener("perennial-auth-changed", loadWatchlist);
  }, []);

  const value = {
    tickers,
    loading,
    isWatched: (ticker: string) => tickers.includes(ticker),
    add: (ticker: string) => {
      if (tickers.includes(ticker)) return;
      setTickers((current) => [...current, ticker]);
      if (isAuthApiConfigured() && getSessionToken() && !isRecoverySession()) {
        void addToWatchlist(ticker).catch(() => setTickers((current) => current.filter((item) => item !== ticker)));
      }
    },
    remove: async (ticker: string) => {
      setRemoving((current) => [...current, ticker]);
      try {
        const { removal } = await removeTicker(tickers, ticker, hasApiSession() ? removeFromWatchlist : null);
        setTickers((current) => withoutTicker(current, ticker));
        return removal;
      } finally {
        setRemoving((current) => withoutTicker(current, ticker));
      }
    },
    restore: async (removal: Removal) => {
      await restoreTicker(tickers, removal, hasApiSession() ? addToWatchlist : null);
      setTickers((current) => withTickerAt(current, removal.ticker, removal.index));
    },
    isRemoving: (ticker: string) => removing.includes(ticker),
  };
  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error("useWatchlist must be used inside WatchlistProvider");
  return context;
}
