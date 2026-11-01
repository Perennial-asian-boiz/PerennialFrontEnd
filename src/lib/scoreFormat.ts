import type { Score } from "../api/score";

// Shared by the score card (S2-01) and the breakdown (S2-02), so both say the same thing.

const UNAVAILABLE_REASONS: Record<string, string> = {
  not_scored: "This company hasn't been scored yet.",
  only_fundamentals: "Only fundamentals are available, and a score needs at least one more component.",
  no_fundamentals: "Fundamentals aren't available yet, and every score needs them.",
};

// Why a score is unavailable, in plain language; an unknown reason gets the general one.
export function unavailableDetail(reason: string | undefined): string {
  return UNAVAILABLE_REASONS[reason ?? ""] ?? "There isn't enough data to score this company yet.";
}

// The score card's colour bands, from the Figma legend: 0–39 Low, 40–69 Mix, 70–100 Strong.
// The band follows the value as shown, to one decimal place, so 39.96 ("40.0") is Mix.
export const SCORE_BANDS = [
  { band: "low", label: "Low", range: "0–39" },
  { band: "mixed", label: "Mix", range: "40–69" },
  { band: "strong", label: "Strong", range: "70–100" },
] as const;

export type ScoreBand = (typeof SCORE_BANDS)[number]["band"];

export function scoreBand(value: number): ScoreBand {
  const shown = Number(value.toFixed(1));
  if (shown < 40) return "low";
  if (shown < 70) return "mixed";
  return "strong";
}

// When the scores batch was promoted, in the market's time zone like the page's other dates.
export function formatAsOf(value: string | null): string | null {
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

// "score-v1 · as of Nov 5, 2026, 12:02 PM EST": the version and as-of a score is shown with.
export function scoreStamp(score: Score): string {
  const asOf = formatAsOf(score.as_of);
  return [score.score_version, asOf && `as of ${asOf}`].filter(Boolean).join(" · ");
}
