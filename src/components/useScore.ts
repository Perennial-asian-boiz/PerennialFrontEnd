import { useEffect, useState } from "react";
import { loadScore, scoreState, type ScoreResponse, type ScoreState } from "../api/score";

// One request per company page for GET /v1/securities/{symbol}/score: the score card
// (S2-01), the breakdown (S2-02) and the why-panel (S2-03) all render from its state.
export function useScore(symbol: string): ScoreState {
  const [result, setResult] = useState<{ symbol: string; response: ScoreResponse | null; error: unknown }>({
    symbol: "",
    response: null,
    error: null,
  });

  useEffect(() => {
    if (!symbol) return;

    const controller = new AbortController();
    loadScore(symbol, controller.signal).then((response) => {
      setResult({ symbol, response, error: null });
    }).catch((caught: unknown) => {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setResult({ symbol, response: null, error: caught });
    });

    return () => controller.abort();
  }, [symbol]);

  const current = result.symbol === symbol;
  return scoreState(current ? result.response : null, current ? result.error : null);
}
