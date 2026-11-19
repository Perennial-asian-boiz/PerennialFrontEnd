import { SENTIMENT_LABELS, type LabelShares, type SentimentChannelName, type SentimentLabel } from "../api/sentiment";

// Pure text and number helpers for the Sentiment Pulse card (S3-02), kept apart so they are
// tested without rendering.

export const LABEL_NAMES: Record<SentimentLabel, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

// Whole percents that add up to exactly 100 (largest remainder): each share is floored, and the
// points left over go to the largest remainders, ties in label order. 0.3333/0.3333/0.3334 is
// 33/33/34. Shares that are all 0 stay 0.
export function wholePercents(shares: LabelShares): Record<SentimentLabel, number> {
  const raw = SENTIMENT_LABELS.map((label) => Math.max(0, shares[label]) * 100);
  const total = raw.reduce((sum, value) => sum + value, 0);
  const result = { positive: 0, neutral: 0, negative: 0 };
  if (total <= 0) return result;
  const scaled = raw.map((value) => (value / total) * 100);
  const floors = scaled.map((value) => Math.floor(value + 1e-9));
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = scaled
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index] += 1;
    left -= 1;
  }
  SENTIMENT_LABELS.forEach((label, index) => { result[label] = floors[index]; });
  return result;
}

export function itemNoun(channel: SentimentChannelName, count: number): string {
  const noun = channel === "news" ? "article" : "post";
  return count === 1 ? noun : `${noun}s`;
}

// "Positive · 8 articles"
export function captionText(label: SentimentLabel, count: number, channel: SentimentChannelName): string {
  return `${LABEL_NAMES[label]} · ${count} ${itemNoun(channel, count)}`;
}

// Dates are shown as UTC calendar days, like the tally date, so a reading reads the same
// everywhere.
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function formatDay(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? null : DAY.format(date);
}

// "Based on 13 articles, Nov 10–17 · tallied Nov 17". Social posts collected on one day read
// "Based on 4 posts collected Nov 17 · tallied Nov 17".
export function sourceLine(
  channel: SentimentChannelName,
  count: number,
  firstAt: string | null,
  lastAt: string | null,
  talliedOn: string,
): string {
  const tallied = formatDay(talliedOn);
  const tail = tallied ? ` · tallied ${tallied}` : "";
  const base = `Based on ${count} ${itemNoun(channel, count)}`;
  const first = formatDay(firstAt);
  const last = formatDay(lastAt);
  if (!first || !last) return `${base}${tail}`;
  if (first === last) return `${base}${channel === "social" ? " collected" : ","} ${first}${tail}`;
  return `${base}, ${dayRange(first, last)}${tail}`;
}

// "Nov 10–17" within a month, "Oct 30–Nov 2" across months.
function dayRange(first: string, last: string): string {
  const [firstMonth] = first.split(" ");
  const [lastMonth, lastDay] = last.split(" ");
  return firstMonth === lastMonth ? `${first}–${lastDay}` : `${first}–${last}`;
}

// "2 of 3 articles needed"
export function coverageText(channel: SentimentChannelName, count: number, minItems: number): string {
  return `${count} of ${minItems} ${itemNoun(channel, minItems)} needed`;
}
