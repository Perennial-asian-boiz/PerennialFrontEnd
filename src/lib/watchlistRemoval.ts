// S3-06: removing a ticker from the saved watchlist, and undoing it.
// List changes only, so they can be tested without React or a browser.

/** AC 2: how long "Undo" stays available after a removal. */
export const UNDO_WINDOW_MS = 5000;

/** A ticker that was removed, and where it sat, so Undo can put it back there. */
export type Removal = { ticker: string; index: number };

/** A removal and the moment (ms since the epoch) its Undo stops being offered. */
export type UndoableRemoval = { removal: Removal; expiresAt: number };

/**
 * The removals that can still be undone at `now`, oldest first. Each keeps its own
 * 5 seconds, so removing a second ticker doesn't cut the first one's Undo short.
 */
export function undoable(entries: readonly UndoableRemoval[], now: number): UndoableRemoval[] {
  return entries.filter((entry) => now < entry.expiresAt);
}

/** `entries` still undoable at `now`, plus `removal`, undoable for UNDO_WINDOW_MS from `now`. */
export function withUndoable(entries: readonly UndoableRemoval[], removal: Removal, now: number): UndoableRemoval[] {
  return [...undoable(entries, now), { removal, expiresAt: now + UNDO_WINDOW_MS }];
}

/**
 * Undo every removal in `entries`, newest first so each returns to the place it was
 * taken from. Resolves with the tickers that were restored and those whose call failed.
 */
export async function restoreAll(
  entries: readonly UndoableRemoval[],
  restore: (removal: Removal) => Promise<unknown>,
): Promise<{ restored: string[]; failed: string[] }> {
  const restored: string[] = [];
  const failed: string[] = [];
  for (const { removal } of [...entries].reverse()) {
    try {
      await restore(removal);
      restored.push(removal.ticker);
    } catch {
      failed.push(removal.ticker);
    }
  }
  return { restored, failed };
}

export function withoutTicker(tickers: readonly string[], ticker: string): string[] {
  return tickers.filter((item) => item !== ticker);
}

/** The list with `ticker` back at `index` (clamped); unchanged if it is already there. */
export function withTickerAt(tickers: readonly string[], ticker: string, index: number): string[] {
  if (tickers.includes(ticker)) return [...tickers];
  const at = Math.min(Math.max(Math.trunc(index) || 0, 0), tickers.length);
  return [...tickers.slice(0, at), ticker, ...tickers.slice(at)];
}

/**
 * Remove `ticker`: the API call runs first (AC 1) and the list changes only after
 * it succeeds, so a failed call leaves the ticker on the list (AC 5) by rejecting.
 * `removeRemote` is null when there is no signed-in API session to call.
 */
export async function removeTicker(
  tickers: readonly string[],
  ticker: string,
  removeRemote: ((ticker: string) => Promise<unknown>) | null,
): Promise<{ tickers: string[]; removal: Removal }> {
  if (removeRemote) await removeRemote(ticker);
  return { tickers: withoutTicker(tickers, ticker), removal: { ticker, index: tickers.indexOf(ticker) } };
}

/** Undo a removal (AC 2): the ticker is saved again, then returns to its place. */
export async function restoreTicker(
  tickers: readonly string[],
  removal: Removal,
  addRemote: ((ticker: string) => Promise<unknown>) | null,
): Promise<string[]> {
  if (addRemote) await addRemote(removal.ticker);
  return withTickerAt(tickers, removal.ticker, removal.index);
}
