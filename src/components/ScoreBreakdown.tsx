import type { Score, ScoreState } from "../api/score";
import { breakdownRows, contributionTotal } from "../lib/scoreBreakdown";
import { scoreStamp, unavailableDetail } from "../lib/scoreFormat";

// S2-02: how the Confidence Score is built, one row per component (FE-3), with the
// loading, not-found and error states (FE-5). The panel keeps one height in every state,
// so nothing beside it shifts while the score loads. The page loads the score once
// (useScore) and passes its state here and to the score card.

const percent = (weight: number) => `${(weight * 100).toFixed(2)}%`;

export default function ScoreBreakdown({ state }: { state: ScoreState }) {
  return <section aria-labelledby="score-breakdown-heading">
    <div className="section-heading"><h2 id="score-breakdown-heading">Score breakdown</h2></div>
    <div className="panel score-breakdown" aria-busy={state.kind === "loading"}>
      {state.kind === "loading" && <p className="auth-muted-line" role="status">Loading score breakdown…</p>}
      {state.kind === "not_found" && <p className="auth-muted-line" role="status">{state.label}</p>}
      {state.kind === "error" && <p className="auth-error" role="alert">{state.label}</p>}
      {state.kind === "unavailable" && <div role="status">
        <p className="score-breakdown-unavailable">{state.label}</p>
        <p className="auth-muted-line">{unavailableDetail(state.reason)}</p>
      </div>}
      {state.kind === "scored" && <BreakdownTable score={state.score} />}
    </div>
  </section>;
}

function BreakdownTable({ score }: { score: Score }) {
  const rows = breakdownRows(score);
  const total = contributionTotal(score);

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
          <td colSpan={6} className="score-breakdown-sum">{scoreStamp(score)}</td>
        </tr>
      </tfoot>}
    </table>
  </div>;
}
