import type { Claim, Explanation, Score } from "../api/score";

// S2-03: which of the explanation's claims the why-panel shows (AC1, AC3), and what it
// says when there's nothing to show (AC5).

export const MAX_CLAIMS = 3;

const UNAVAILABLE_REASONS: Record<string, string> = {
  insufficient_supporting_data: "There isn't enough supporting data to explain this recommendation.",
  not_explained_yet: "This score hasn't been explained yet. Please check back later.",
  score_unavailable: "There's no explanation because the score is unavailable.",
  not_scored: "There's no explanation because this company hasn't been scored yet.",
};

// Up to three claims in the served order. A claim about a component the score has as
// missing or unavailable is dropped, so the panel never contradicts the breakdown.
export function explanationClaims(score: Score, explanation: Explanation): Claim[] {
  if (explanation.status !== "ok") return [];
  const available = new Set(score.components.filter((component) => component.status === "ok").map((component) => component.name));
  return explanation.claims
    .filter((claim) => available.has(claim.component) && !score.missing.includes(claim.component))
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_CLAIMS);
}

// Why there are no supporting signals, in plain language; an unknown reason gets the general one.
export function explanationDetail(explanation: Explanation): string {
  if (explanation.status === "not_recommended") {
    return "Perennial recommends a company only when its Confidence Score is at least 60, so there are no supporting signals to show.";
  }
  return UNAVAILABLE_REASONS[explanation.reason ?? ""] ?? "An explanation isn't available for this company yet.";
}
