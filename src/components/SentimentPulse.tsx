import { useState } from "react";
import {
  SENTIMENT_LABELS,
  type SentimentChannel,
  type SentimentChannelName,
  type SentimentState,
} from "../api/sentiment";
import {
  LABEL_NAMES,
  captionText,
  coverageText,
  itemNoun,
  sourceLine,
  wholePercents,
} from "../lib/sentimentFormat";
import type { SentimentTrendState } from "../api/sentimentTrend";
import SentimentTrend from "./SentimentTrend";
import { useSentiment, useSentimentTrend } from "./useSentiment";

// S3-02: the Company page's Sentiment Pulse card. One request serves both tabs' bars (piece 1);
// the tab is local state, so switching never refetches. Opens on News; the page remounts the
// card (key = symbol) for each company. A second request serves the 30-day trend (AC2), the
// same on both tabs, with its own loading, error and Retry.
export default function SentimentPulse({ symbol }: { symbol: string }) {
  const { state, retry } = useSentiment(symbol);
  const trend = useSentimentTrend(symbol);
  const [channel, setChannel] = useState<SentimentChannelName>("news");
  return <SentimentPulseView
    state={state}
    channel={channel}
    onChannel={setChannel}
    onRetry={retry}
    trend={trend.state}
    onRetryTrend={trend.retry}
  />;
}

type ViewProps = {
  state: SentimentState;
  channel: SentimentChannelName;
  onChannel: (channel: SentimentChannelName) => void;
  onRetry: () => void;
  trend?: SentimentTrendState;
  onRetryTrend?: () => void;
};

export function SentimentPulseView({ state, channel, onChannel, onRetry, trend, onRetryTrend }: ViewProps) {
  return <section className="panel detail-data-card" aria-labelledby="sentiment-pulse-heading" aria-busy={state.kind === "loading"}>
    <div className="detail-data-heading">
      <div><h2 id="sentiment-pulse-heading" className="detail-data-title">Sentiment Pulse</h2><p>News and social sentiment</p></div>
    </div>
    <div className="sentiment-tabs" role="group" aria-label="Sentiment source">
      <TabButton channel="news" selected={channel} onChannel={onChannel}>News</TabButton>
      <TabButton channel="social" selected={channel} onChannel={onChannel}>Social</TabButton>
    </div>
    <SentimentBody state={state} channel={channel} onRetry={onRetry} />
    {trend && <SentimentTrend state={trend} onRetry={onRetryTrend ?? (() => undefined)} />}
  </section>;
}

function TabButton({ channel, selected, onChannel, children }: {
  channel: SentimentChannelName; selected: SentimentChannelName;
  onChannel: (channel: SentimentChannelName) => void; children: string;
}) {
  const isSelected = channel === selected;
  return <button type="button" className={isSelected ? "selected" : ""} aria-pressed={isSelected} onClick={() => onChannel(channel)}>{children}</button>;
}

function SentimentBody({ state, channel, onRetry }: { state: SentimentState; channel: SentimentChannelName; onRetry: () => void }) {
  if (state.kind === "loading") return <LoadingBars />;
  if (state.kind === "error") {
    return <div className="sentiment-message" role="alert">
      <p>Sentiment couldn't be loaded.</p>
      <button type="button" className="sentiment-retry" onClick={onRetry}>Retry</button>
    </div>;
  }
  if (state.kind === "unavailable") {
    return <p className="sentiment-message">No sentiment data for this company yet.</p>;
  }
  const { reading } = state;
  const data = reading[channel];
  if (data.status !== "ok" || !data.shares) {
    return <div className="sentiment-message">
      <p className="sentiment-coverage-title">Not enough coverage</p>
      <p className="detail-data-note">{coverageText(channel, data.count, reading.min_items)}</p>
    </div>;
  }
  return <>
    <ChannelBars channel={channel} data={data} />
    {channel === "news" && <p className="sentiment-weight-note">Weighted by source credibility and age</p>}
    <p className="sentiment-source-line">{sourceLine(channel, data.count, data.first_at, data.last_at, reading.tallied_on)}</p>
  </>;
}

function ChannelBars({ channel, data }: { channel: SentimentChannelName; data: SentimentChannel }) {
  const percents = wholePercents(data.shares!);
  return <div className="sentiment-bars" aria-label={`${channel === "news" ? "News" : "Social"} sentiment breakdown`}>
    {SENTIMENT_LABELS.map((label) => {
      const count = data.counts[label];
      const percent = percents[label];
      return <div
        className={`sentiment-meter ${label}`}
        key={label}
        role="group"
        aria-label={`${LABEL_NAMES[label]}: ${percent} percent, ${count} ${itemNoun(channel, count)}`}
      >
        <div className="sentiment-meter-track" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
          <strong>{percent}%</strong>
        </div>
        <div className="sentiment-meter-caption" aria-hidden="true"><span>{captionText(label, count, channel)}</span></div>
      </div>;
    })}
  </div>;
}

function LoadingBars() {
  return <div className="sentiment-bars sentiment-loading" aria-label="Loading sentiment">
    {SENTIMENT_LABELS.map((label) => <div className="sentiment-meter" key={label}>
      <span className="loading-bar sentiment-loading-track" />
      <span className="loading-bar sentiment-loading-caption" />
    </div>)}
  </div>;
}
