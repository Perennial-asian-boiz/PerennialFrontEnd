import type { SentimentTrendState, TrendPoint } from "../api/sentimentTrend";
import { formatDay, trendPointText, trendSummary, trendTickIndexes } from "../lib/sentimentFormat";

// S3-02 AC2: the 30-day trend at the bottom of the Sentiment Pulse card. One bar per day on a
// fixed −1 to +1 scale around a zero line: green above for a positive reading, red below for
// a negative one. A day without a reading has no bar, only a faint dot, so it never looks like
// a 0. The bars are SVG; the labels are HTML so they keep their size on narrow screens.
const WIDTH = 940;
const HEIGHT = 200;
const MIDDLE = HEIGHT / 2;
const HALF = MIDDLE - 4; // a reading of ±1 reaches 4 units from the edge
const GAP = 6;

export default function SentimentTrend({ state, onRetry }: { state: SentimentTrendState; onRetry: () => void }) {
  return <div className="sentiment-trend" aria-busy={state.kind === "loading"}>
    <div className="sentiment-trend-head">
      <h3>30-day trend</h3>
      <span>Overall reading per day · hover a bar for its value</span>
    </div>
    <TrendBody state={state} onRetry={onRetry} />
  </div>;
}

function TrendBody({ state, onRetry }: { state: SentimentTrendState; onRetry: () => void }) {
  if (state.kind === "loading") return <span className="loading-bar sentiment-trend-loading" aria-label="Loading the 30-day trend" />;
  if (state.kind === "error") {
    return <div className="sentiment-message" role="alert">
      <p>The 30-day trend couldn't be loaded.</p>
      <button type="button" className="sentiment-retry" onClick={onRetry}>Retry</button>
    </div>;
  }
  if (state.kind === "empty") return <p className="sentiment-message">No readings in the last 30 days.</p>;
  return <TrendChart points={state.trend.points} />;
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const slot = WIDTH / points.length;
  const bar = Math.max(1, slot - GAP);
  const ticks = trendTickIndexes(points.length);
  return <>
    <div className="sentiment-trend-body">
      <div className="sentiment-trend-axis" aria-hidden="true"><span>+1</span><span>0</span><span>−1</span></div>
      <svg className="sentiment-trend-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={trendSummary(points)}>
        <line x1="0" x2={WIDTH} y1={MIDDLE} y2={MIDDLE} className="sentiment-trend-zero" vectorEffect="non-scaling-stroke" />
        {points.map((point, index) => <TrendBar key={point.date} point={point} x={index * slot + GAP / 2} width={bar} />)}
      </svg>
    </div>
    <div className="sentiment-trend-dates" aria-hidden="true">
      {ticks.map((index) => <span
        key={index}
        className={index === 0 ? "first" : index === points.length - 1 ? "last" : ""}
        style={{ left: `${((index + 0.5) / points.length) * 100}%` }}
      >{formatDay(points[index].date)}</span>)}
    </div>
    <p className="sentiment-trend-legend" aria-hidden="true">
      <i className="up" /> Positive <i className="down" /> Negative <i className="none" /> No reading that day
    </p>
  </>;
}

function TrendBar({ point, x, width }: { point: TrendPoint; x: number; width: number }) {
  const label = trendPointText(point.date, point.value);
  if (point.value === null) {
    return <rect className="sentiment-trend-gap" x={x + width / 2 - 2.5} y={MIDDLE - 2.5} width="5" height="5" rx="2.5"><title>{label}</title></rect>;
  }
  // A true 0 still gets a sliver, so it reads as a neutral day, not a missing one.
  const height = Math.max(2, Math.abs(point.value) * HALF);
  const positive = point.value >= 0;
  return <rect
    className={positive ? "sentiment-trend-up" : "sentiment-trend-down"}
    x={x}
    width={width}
    y={positive ? MIDDLE - height : MIDDLE}
    height={height}
    rx="2"
  ><title>{label}</title></rect>;
}
