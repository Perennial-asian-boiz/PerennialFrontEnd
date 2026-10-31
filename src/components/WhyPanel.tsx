import type { Claim, Explanation, ScoreState } from "../api/score";
import { componentLabel } from "../lib/scoreBreakdown";
import { explanationClaims, explanationDetail } from "../lib/scoreExplanation";
import { formatAsOf } from "../lib/scoreFormat";

// S2-03: why Perennial recommends the company, as up to three supporting signals in plain
// language (AC1), each citing its breakdown component, stored record and as-of (AC2, AC3),
// or a statement that an explanation is unavailable (AC5). It renders from the same
// useScore state as the score card and the breakdown. The heading says "recommends" only
// when there are claims to show, so it never sits above "Not recommended".
export default function WhyPanel({ state }: { state: ScoreState }) {
  const claims = state.kind === "scored" ? explanationClaims(state.score, state.explanation) : [];
  return <section aria-labelledby="why-panel-heading">
    <div className="section-heading">
      <h2 id="why-panel-heading">{claims.length > 0 ? "Why Perennial recommends it" : "Recommendation"}</h2>
    </div>
    <div className="panel" aria-busy={state.kind === "loading"}>
      {state.kind === "loading" && <p className="auth-muted-line" role="status">Loading explanation…</p>}
      {state.kind === "not_found" && <p className="auth-muted-line" role="status">{state.label}</p>}
      {state.kind === "error" && <p className="auth-error" role="alert">{state.label}</p>}
      {state.kind === "unavailable" && <Unavailable explanation={{ ...state.explanation, status: "unavailable", reason: state.explanation.reason ?? "score_unavailable" }} />}
      {state.kind === "scored" && <Explained explanation={state.explanation} claims={claims} />}
    </div>
  </section>;
}

function Explained({ explanation, claims }: { explanation: Explanation; claims: Claim[] }) {
  if (claims.length === 0) {
    // A served "ok" with nothing left to cite reads as insufficient supporting data.
    return <Unavailable explanation={explanation.status === "ok"
      ? { ...explanation, status: "unavailable", reason: "insufficient_supporting_data" }
      : explanation} />;
  }

  const asOf = formatAsOf(explanation.as_of ?? null);
  const stamp = [explanation.template_version, asOf && `as of ${asOf}`].filter(Boolean).join(" · ");
  return <>
    <ol className="reason-list why-claims">
      {claims.map((claim) => <li key={claim.order}><ClaimItem claim={claim} /></li>)}
    </ol>
    {stamp && <p className="score-breakdown-sum why-stamp">{stamp}</p>}
  </>;
}

function ClaimItem({ claim }: { claim: Claim }) {
  return <div>
    <p className="why-claim-text">{claim.text}</p>
    <details className="why-claim-source">
      <summary>{componentLabel(claim.component)} · as of {claim.as_of}</summary>
      <dl>
        <dt>Source</dt><dd>{claim.record.table} #{claim.record.id}, batch {claim.record.batch_id}</dd>
        <dt>Measure</dt><dd>{claim.measure.replaceAll("_", " ")}</dd>
        <dt>Stored value</dt><dd>{claim.value}</dd>
      </dl>
    </details>
  </div>;
}

function Unavailable({ explanation }: { explanation: Explanation }) {
  return <div role="status">
    <p className="score-breakdown-unavailable">
      {explanation.status === "not_recommended" ? "Not recommended" : "Explanation unavailable"}
    </p>
    <p className="why-detail">{explanationDetail(explanation)}</p>
  </div>;
}
