import type { Claim, Explanation, ScoreState } from "../api/score";
import { componentLabel } from "../lib/scoreBreakdown";
import { claimTitle, explanationClaims, explanationDetail } from "../lib/scoreExplanation";

// S2-03: why Perennial recommends the company, as up to three supporting signals in plain
// language (AC1), each citing its breakdown component, stored record and as-of (AC2, AC3),
// laid out as the Figma recommendation card. It renders from the same useScore state
// as the score card and the breakdown, and only for a recommended company: with claims it
// shows them, and without them it says an explanation is unavailable (AC5). A company that
// isn't recommended, has no score, or is still loading gets no card at all.
export default function WhyPanel({ state }: { state: ScoreState }) {
  if (state.kind !== "scored") return null;
  const { score, explanation } = state;
  const claims = explanationClaims(score, explanation);
  if (claims.length === 0 && (!score.recommended || explanation.status === "not_recommended")) return null;

  return <section className="panel why-card" aria-labelledby="why-panel-heading">
    <div className="card-header">
      <div className="why-heading">
        <span className="why-icon" aria-hidden="true"><LightbulbIcon /></span>
        <h2 id="why-panel-heading" className="card-title">Why Perennial recommends this company</h2>
      </div>
      {claims.length > 0 && <span className="card-eyebrow">Key reasons</span>}
    </div>
    {claims.length > 0
      ? <Explained claims={claims} />
      // A served "ok" with nothing left to cite reads as insufficient supporting data.
      : <Unavailable explanation={explanation.status === "ok"
        ? { ...explanation, status: "unavailable", reason: "insufficient_supporting_data" }
        : explanation} />}
  </section>;
}

function Explained({ claims }: { claims: Claim[] }) {
  return <ol className="why-claims">
    {claims.map((claim) => <li key={claim.order}><ClaimItem claim={claim} /></li>)}
  </ol>;
}

// A Figma reason card: the title and the claim; tapping it shows the stored record, value
// and as-of the claim cites (AC2).
function ClaimItem({ claim }: { claim: Claim }) {
  return <details className="why-reason">
    <summary>
      <CheckIcon />
      <span className="why-reason-body">
        <span className="why-claim-title">{claimTitle(claim)}</span>
        <span className="why-claim-text">{claim.text}</span>
      </span>
    </summary>
    <dl className="why-claim-source">
      <dt>Component</dt><dd>{componentLabel(claim.component)}</dd>
      <dt>Source</dt><dd>{claim.record.table} #{claim.record.id}, batch {claim.record.batch_id}</dd>
      <dt>Measure</dt><dd>{claim.measure.replaceAll("_", " ")}</dd>
      <dt>Stored value</dt><dd>{claim.value}</dd>
      <dt>As of</dt><dd>{claim.as_of}</dd>
    </dl>
  </details>;
}

function Unavailable({ explanation }: { explanation: Explanation }) {
  return <div role="status">
    <p className="score-breakdown-unavailable">Explanation unavailable</p>
    <p className="why-detail">{explanationDetail(explanation)}</p>
  </div>;
}

function LightbulbIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z" />
  </svg>;
}

function CheckIcon() {
  return <svg className="why-check" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="currentColor" /><path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
