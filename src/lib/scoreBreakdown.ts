import type { Score } from "../api/score";

// S2-02: the score breakdown's rows (02-AC1/AC3/AC4) and its footer sum (02-AC2).

export const MISSING_TEXT = "Unavailable — weight redistributed to the other components";
// The contributions are rounded to 0.01 and the score to 0.1, so their sum may differ
// from the score; S2-02 AC2 allows half a point.
export const SUM_TOLERANCE = 0.5;

const LABELS: Record<string, string> = {
  fundamentals: "Fundamentals",
  sentiment: "News sentiment",
  event_exposure: "Event exposure",
};

// A component's name as the breakdown shows it; the why-panel (S2-03) cites it the same way.
export function componentLabel(name: string): string {
  return LABELS[name] ?? name.replaceAll("_", " ");
}

export type BreakdownRow = {
  name: string;
  label: string;
  status: "ok" | "unavailable";
  value: number | null;
  weight: number;
  nominalWeight: number;
  contribution: number;
  inputAsOf: string | null;
  version: string | null;
  note: string | null;
};

export type ContributionTotal = {
  total: number;
  consistent: boolean;
};

function hasBreakdown(score: Score): boolean {
  return score.status === "ok" && score.value !== null && score.components.length > 0;
}

// One row per component, in the served order; none for an unavailable score.
export function breakdownRows(score: Score): BreakdownRow[] {
  if (!hasBreakdown(score)) return [];
  return score.components.map((component) => ({
    name: component.name,
    label: componentLabel(component.name),
    status: component.status,
    value: component.value,
    weight: component.weight,
    nominalWeight: component.nominal_weight,
    contribution: component.contribution,
    inputAsOf: component.input_as_of,
    version: component.input_version,
    note: component.status === "ok" ? null : MISSING_TEXT,
  }));
}

// The sum of the contributions, and whether it agrees with the served score.
export function contributionTotal(score: Score): ContributionTotal | null {
  if (!hasBreakdown(score) || score.value === null) return null;
  const total = score.components.reduce((sum, component) => sum + component.contribution, 0);
  // A small epsilon so a difference of exactly 0.5 isn't lost to binary rounding.
  return { total, consistent: Math.abs(total - score.value) <= SUM_TOLERANCE + 1e-9 };
}
