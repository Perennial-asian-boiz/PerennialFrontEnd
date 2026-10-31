import type { ScoreState } from "../api/score";
import { scoreStamp, unavailableDetail } from "../lib/scoreFormat";
import { ScoreRing } from "./AppShell";

// S2-01: the company's Confidence Score from 0 to 100 with its version and as-of (AC1),
// or "Score unavailable" and why, never an invented number (AC4).
export default function ScoreCard({ state }: { state: ScoreState }) {
  return <section aria-labelledby="score-card-heading">
    <div className="section-heading"><h2 id="score-card-heading">Confidence Score</h2></div>
    <div className="panel" aria-busy={state.kind === "loading"}>
      {state.kind === "loading" && <p className="auth-muted-line" role="status">Loading score…</p>}
      {state.kind === "not_found" && <p className="auth-muted-line" role="status">{state.label}</p>}
      {state.kind === "error" && <p className="auth-error" role="alert">{state.label}</p>}
      {state.kind === "unavailable" && <div role="status">
        <p className="score-breakdown-unavailable">{state.label}</p>
        <p className="auth-muted-line">{unavailableDetail(state.reason)}</p>
      </div>}
      {state.kind === "scored" && state.score.value !== null && <div className="score-card">
        <div role="img" aria-label={`Confidence Score ${state.score.value.toFixed(1)} out of 100`}>
          <ScoreRing score={state.score.value} />
        </div>
        <div>
          <p className="score-card-caption">Combines the company's financial reports with recent news and social sentiment.</p>
          <p className="score-breakdown-sum">{scoreStamp(state.score)}</p>
        </div>
      </div>}
    </div>
  </section>;
}
