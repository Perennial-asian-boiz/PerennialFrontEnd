import { useEffect, useState } from "react";
import { loadScore, scoreState, type Score, type ScoreResponse } from "../api/score";
import { breakdownRows, contributionTotal } from "../lib/scoreBreakdown";

// S2-02: how the Confidence Score is built, one row per component (FE-3), with the
// loading, not-found and error states (FE-5). The panel keeps one height in every state,
// so nothing beside it shifts while the score loads.

const UNAVAILABLE_REASONS: Record<string, string> = {
  not_scored: "This company hasn't been scored yet.",
  only_fundamentals: "Only fundamentals are available, and a score needs at least one more component.",
  no_fundamentals: "Fundamentals aren't available yet, and every score needs them.",
};

const percent = (weight: number) => `${(weight * 100).toFixed(2)}%`;

// When the scores batch was promoted, in the market's time zone like the page's other dates.
function formatAsOf(value: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(date);
}

export default function ScoreBreakdown({ symbol }: { symbol: string }) {
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
  const state = scoreState(current ? result.response : null, current ? result.error : null);

  return <section aria-labelledby="score-breakdown-heading">
    <div className="section-heading"><h2 id="score-breakdown-heading">Score breakdown</h2></div>
    <div className="panel score-breakdown" aria-busy={state.kind === "loading"}>
      {state.kind === "loading" && <p className="auth-muted-line" role="status">Loading score breakdown…</p>}
      {state.kind === "not_found" && <p className="auth-muted-line" role="status">{state.label}</p>}
      {state.kind === "error" && <p className="auth-error" role="alert">{state.label}</p>}
      {state.kind === "unavailable" && <div role="status">
        <p className="score-breakdown-unavailable">{state.label}</p>
        <p className="auth-muted-line">{UNAVAILABLE_REASONS[state.reason ?? ""] ?? "There isn't enough data to score this company yet."}</p>
      </div>}
      {state.kind === "scored" && <BreakdownTable score={state.score} />}
    </div>
  </section>;
}

function BreakdownTable({ score }: { score: Score }) {
  const rows = breakdownRows(score);
  const total = contributionTotal(score);
  const asOf = formatAsOf(score.as_of);

  return <div className="table-wrap">
    <table className="data-table score-breakdown-table">
      <thead>
        <tr>
          <th scope="col">Component</th>
          <th scope="col">Value</th>
          <th scope="col">Weight</th>
          <th scope="col">Contribution</th>
          <th scope="col">Input as of</th>
          <th scope="col">Version</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => <tr key={row.name}>
          <th scope="row">{row.label}</th>
          {row.note === null ? <>
            <td>{row.value === null ? "—" : row.value.toFixed(1)}</td>
            <td><span title={`Nominal weight ${percent(row.nominalWeight)}`}>{percent(row.weight)}</span></td>
            <td>{row.contribution.toFixed(2)}</td>
            <td>{row.inputAsOf ?? "—"}</td>
            <td>{row.version ?? "—"}</td>
          </> : <td colSpan={5} className="score-breakdown-note" title={`Nominal weight ${percent(row.nominalWeight)}`}>{row.note}</td>}
        </tr>)}
      </tbody>
      {total && score.value !== null && <tfoot>
        <tr>
          <th scope="row">Total</th>
          <td colSpan={2} />
          <td>{total.total.toFixed(2)}</td>
          <td colSpan={2} className={total.consistent ? "score-breakdown-sum" : "auth-error"}>
            {total.consistent
              ? `Score ${score.value.toFixed(1)} (contributions are rounded to 0.01)`
              : `Doesn't match the score of ${score.value.toFixed(1)}`}
          </td>
        </tr>
        <tr>
          <td colSpan={6} className="score-breakdown-sum">
            {[score.score_version, asOf && `as of ${asOf}`]
              .filter(Boolean)
              .join(" · ")}
          </td>
        </tr>
      </tfoot>}
    </table>
  </div>;
}
