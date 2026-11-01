import type { ScoreState } from "../api/score";
import { SCORE_BANDS, scoreBand, scoreStamp, unavailableDetail } from "../lib/scoreFormat";

// S2-01: the company's Confidence Score from 0 to 100 with its version and as-of (AC1),
// or "Score unavailable" and why, never an invented number (AC4). Laid out as the Figma
// "Valuation confidence" card: a ring coloured by band, the title, and the band legend.

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ScoreCard({ state }: { state: ScoreState }) {
  const value = state.kind === "scored" ? state.score.value : null;
  return <section className="panel confidence-card" aria-labelledby="score-card-heading" aria-busy={state.kind === "loading"}>
    <h2 id="score-card-heading" className="confidence-eyebrow">Valuation confidence</h2>
    {state.kind === "scored" && value !== null ? <>
      <ConfidenceRing value={value} />
      <p className="confidence-title">Confidence Score</p>
      <p className="confidence-caption">Combines the company's financial reports with recent news and social sentiment.</p>
      <p className="confidence-stamp">{scoreStamp(state.score)}</p>
      <ul className="confidence-legend" aria-label="Score bands">
        {SCORE_BANDS.map(({ band, label, range }) => <li key={band} className={`confidence-band-${band}`}>{range} {label}</li>)}
      </ul>
    </> : <>
      {/* No score: only the statement, never an empty ring or legend with nothing to draw. */}
      {state.kind === "loading" && <p className="confidence-caption confidence-status" role="status">Loading score…</p>}
      {state.kind === "not_found" && <p className="confidence-caption confidence-status" role="status">{state.label}</p>}
      {state.kind === "error" && <p className="auth-error" role="alert">{state.label}</p>}
      {state.kind === "unavailable" && <div className="confidence-status" role="status">
        <p className="confidence-title">{state.label}</p>
        <p className="confidence-caption">{unavailableDetail(state.reason)}</p>
      </div>}
    </>}
  </section>;
}

// The ring fills clockwise from the top in proportion to the score.
function ConfidenceRing({ value }: { value: number }) {
  const band = scoreBand(value);
  const filled = (Math.min(Math.max(value, 0), 100) / 100) * CIRCUMFERENCE;
  return <div
    className={`confidence-ring confidence-band-${band}`}
    role="img"
    aria-label={`Confidence Score ${value.toFixed(1)} out of 100, ${band}`}
  >
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle
        className="confidence-ring-value"
        cx="60" cy="60" r={RADIUS}
        strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
        transform="rotate(-90 60 60)"
      />
    </svg>
    <span className="confidence-ring-number">{value.toFixed(1)}</span>
  </div>;
}
