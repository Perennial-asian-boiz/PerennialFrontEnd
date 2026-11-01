import type { Claim, Explanation, Score } from "../api/score";

// S2-03: which of the explanation's claims the why-panel shows (AC1, AC3), and what it
// says when there's nothing to show (AC5).

export const MAX_CLAIMS = 3;

const UNAVAILABLE_REASONS: Record<string, string> = {
  insufficient_supporting_data: "There isn't enough supporting data to explain this recommendation.",
  not_explained_yet: "This score hasn't been explained yet. Please check back later.",
};

// A claim is only ever a supporting signal (decision 103 (c)), so each measure gets a
// positive title, as the Figma reason cards have; the claim's own text sits under it.
const CLAIM_TITLES: Record<string, string> = {
  revenue_growth_3y: "Strong revenue growth",
  operating_margin: "Healthy operating margin",
  operating_margin_trend: "Improving operating margin",
  return_on_equity: "Strong return on equity",
  efficiency_ratio: "Efficient operations",
};

export function claimTitle(claim: Claim): string {
  if (claim.component === "sentiment") return "Positive sentiment";
  const title = CLAIM_TITLES[claim.measure] ?? claim.measure.replaceAll("_", " ");
  return title.charAt(0).toUpperCase() + title.slice(1);
}

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

// Why a recommended company has no supporting signals to show, in plain language; an
// unknown reason gets the general one.
export function explanationDetail(explanation: Explanation): string {
  return UNAVAILABLE_REASONS[explanation.reason ?? ""] ?? "An explanation isn't available for this company yet.";
}
