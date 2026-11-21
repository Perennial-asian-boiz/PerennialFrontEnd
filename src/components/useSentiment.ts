import { useCallback, useEffect, useState } from "react";
import { loadSentiment, sentimentState, type SentimentState } from "../api/sentiment";
import { loadSentimentTrend, sentimentTrendState, type SentimentTrendState } from "../api/sentimentTrend";
import {
  loadSentimentArticles,
  sentimentArticlesState,
  type SentimentArticlesState,
} from "../api/sentimentArticles";

// One request per company page and per retry; a result for another company, or for an
// earlier attempt, is stale and shows as loading instead.
function useRetryable<Response, State>(
  symbol: string,
  load: (symbol: string, signal: AbortSignal) => Promise<Response>,
  toState: (response: Response | null, error?: unknown) => State,
): { state: State; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; response: Response | null; error: unknown }>({
    key: "", response: null, error: null,
  });
  const key = `${symbol}#${attempt}`;

  useEffect(() => {
    if (!symbol) return;

    const controller = new AbortController();
    load(symbol, controller.signal).then((response) => {
      setResult({ key, response, error: null });
    }).catch((caught: unknown) => {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setResult({ key, response: null, error: caught });
    });

    return () => controller.abort();
  }, [symbol, key, load]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  const current = result.key === key;
  return { state: toState(current ? result.response : null, current ? result.error : null), retry };
}

// GET /v1/securities/{symbol}/sentiment (S3-02 piece 1). Both tabs render from it, so
// switching News/Social never refetches.
export function useSentiment(symbol: string): { state: SentimentState; retry: () => void } {
  return useRetryable(symbol, loadSentiment, sentimentState);
}

// GET /v1/securities/{symbol}/sentiment/trend (S3-02 AC2), with its own Retry.
export function useSentimentTrend(symbol: string): { state: SentimentTrendState; retry: () => void } {
  return useRetryable(symbol, loadSentimentTrend, sentimentTrendState);
}

// GET /v1/securities/{symbol}/sentiment/articles (S3-02 AC3), with its own Retry.
export function useSentimentArticles(symbol: string): { state: SentimentArticlesState; retry: () => void } {
  return useRetryable(symbol, loadSentimentArticles, sentimentArticlesState);
}
