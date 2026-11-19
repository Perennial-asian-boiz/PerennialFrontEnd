import { useCallback, useEffect, useState } from "react";
import { loadSentiment, sentimentState, type SentimentResponse, type SentimentState } from "../api/sentiment";

// One request per company page for GET /v1/securities/{symbol}/sentiment (S3-02). Both tabs
// render from it, so switching News/Social never refetches. retry() runs the request again.
export function useSentiment(symbol: string): { state: SentimentState; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string; response: SentimentResponse | null; error: unknown;
  }>({ key: "", response: null, error: null });
  const key = `${symbol}#${attempt}`;

  useEffect(() => {
    if (!symbol) return;

    const controller = new AbortController();
    loadSentiment(symbol, controller.signal).then((response) => {
      setResult({ key, response, error: null });
    }).catch((caught: unknown) => {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setResult({ key, response: null, error: caught });
    });

    return () => controller.abort();
  }, [symbol, key]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  // A result for another company, or for an earlier attempt, is stale: show loading instead.
  const current = result.key === key;
  return { state: sentimentState(current ? result.response : null, current ? result.error : null), retry };
}
