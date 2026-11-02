import type { Score, ScoreState } from "../api/score";
import { breakdownRows, contributionTotal, type BreakdownRow } from "../lib/scoreBreakdown";
import { SCORE_BANDS, scoreBand, scoreStamp } from "../lib/scoreFormat";

// S2-02: how the Confidence Score is built, one bar per component (FE-3), with the
// loading, not-found and error states (FE-5), laid out as the Figma "Score Breakdown"
// card. Each factor shows its band and value; tapping it, as the Figma subtitle says, shows
// its weight and contribution (AC1) and its input as-of and version when stored (AC3). A
// missing one reads "Unavailable" (AC4); the footer adds the contributions up (AC2). The
// page loads the score once (useScore) and passes its state here and to the score card.

const percent = (weight: number) => `${(weight * 100).toFixed(2)}%`;

// Rendered only when there are factors to draw: while loading, for an unavailable score
// and on errors the score card above already says so, so this card stays out of the way.
export default function ScoreBreakdown({ state }: { state: ScoreState }) {
  const rows = state.kind === "scored" ? breakdownRows(state.score) : [];
  if (state.kind !== "scored" || rows.length === 0) return null;
  const active = rows.filter((row) => row.note === null).length;
  return <section className="panel breakdown-card" aria-labelledby="score-breakdown-heading">
    <div className="card-header">
      <div>
        <h2 id="score-breakdown-heading" className="card-title">Score Breakdown</h2>
        <p className="card-subtitle">Tap any factor to inspect fundamental quantitative weights</p>
      </div>
      <span className="factor-badge">Factors ({active} Active)</span>
    </div>
    <Factors score={state.score} rows={rows} />
  </section>;
}

function Factors({ score, rows }: { score: Score; rows: BreakdownRow[] }) {
  const total = contributionTotal(score);
  return <>
    <ul className="factor-list">
      {rows.map((row) => <li key={row.name}>{row.note === null ? <Factor row={row} /> : <MissingFactor row={row} />}</li>)}
    </ul>
    {total && score.value !== null && <div className="factor-footer">
      <p className={total.consistent ? undefined : "auth-error"}>
        Contributions add up to {total.total.toFixed(2)} · {total.consistent
          ? `Score ${score.value.toFixed(1)} (contributions are rounded to 0.01)`
          : `Doesn't match the score of ${score.value.toFixed(1)}`}
      </p>
      <p>{scoreStamp(score)}</p>
    </div>}
  </>;
}

function Factor({ row }: { row: BreakdownRow }) {
  const value = row.value ?? 0;
  const band = scoreBand(value);
  const label = SCORE_BANDS.find((entry) => entry.band === band)?.label;
  return <details className={`factor confidence-band-${band}`}>
    <summary>
      <span className="factor-top">
        <span className="factor-name">{row.label}</span>
        <span className="factor-pill">{label} ({value.toFixed(1)})</span>
      </span>
      <span className="factor-bar" aria-hidden="true"><span style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} /></span>
    </summary>
    <dl className="factor-details">
      <dt>Weight</dt><dd>{percent(row.weight)} <span className="factor-nominal">(nominal {percent(row.nominalWeight)})</span></dd>
      <dt>Contribution</dt><dd>{row.contribution.toFixed(2)} points</dd>
      {row.inputAsOf && <><dt>Input as of</dt><dd>{row.inputAsOf}</dd></>}
      {row.version && <><dt>Version</dt><dd>{row.version}</dd></>}
    </dl>
  </details>;
}

function MissingFactor({ row }: { row: BreakdownRow }) {
  return <div className="factor confidence-band-none">
    <span className="factor-top">
      <span className="factor-name">{row.label}</span>
      <span className="factor-pill">Unavailable</span>
    </span>
    <span className="factor-bar" aria-hidden="true" />
    <span className="factor-note" title={`Nominal weight ${percent(row.nominalWeight)}`}>{row.note}</span>
  </div>;
}
