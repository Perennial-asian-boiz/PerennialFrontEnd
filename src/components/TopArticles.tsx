import { safeArticleUrl, type SentimentArticlesState, type TopArticle } from "../api/sentimentArticles";
import { LABEL_NAMES, articleMeta, shareText } from "../lib/sentimentFormat";

// S3-02 AC3: the 5 news articles that carried the most weight in the current reading, on the
// News tab between the bars and the 30-day trend. Each headline links to the original article
// (http or https only); the weight is the article's share of the reading's total weight.
export default function TopArticles({ state, onRetry }: { state: SentimentArticlesState; onRetry: () => void }) {
  if (state.kind === "none") return null;
  return <div className="top-articles" aria-busy={state.kind === "loading"}>
    <div className="top-articles-head">
      <h3 id="top-articles-heading">Top contributing articles</h3>
      <span>The 5 articles that carried the most weight in this reading</span>
    </div>
    <TopArticlesBody state={state} onRetry={onRetry} />
  </div>;
}

function TopArticlesBody({ state, onRetry }: { state: SentimentArticlesState; onRetry: () => void }) {
  if (state.kind === "loading") {
    return <div className="top-articles-loading" aria-label="Loading the top articles">
      {[0, 1, 2].map((row) => <span key={row} className="loading-bar" />)}
    </div>;
  }
  if (state.kind === "error") {
    return <div className="sentiment-message" role="alert">
      <p>The top articles couldn't be loaded.</p>
      <button type="button" className="sentiment-retry" onClick={onRetry}>Retry</button>
    </div>;
  }
  if (state.kind !== "articles") return null;
  return <>
    <ol className="top-articles-list" aria-labelledby="top-articles-heading">
      {state.articles.map((article) => <ArticleRow key={article.rank} article={article} heaviest={state.articles[0].share} />)}
    </ol>
    <p className="top-articles-note">
      Weight = source credibility × how recent × how much the article is about the company.
      {" "}{state.count} {state.count === 1 ? "article" : "articles"} counted in all.
    </p>
  </>;
}

// The meter is relative to the heaviest article, so the list's differences are visible.
function ArticleRow({ article, heaviest }: { article: TopArticle; heaviest: number }) {
  const url = safeArticleUrl(article.url);
  const share = shareText(article.share);
  const label = LABEL_NAMES[article.label];
  return <li>
    <span className="top-articles-rank" aria-hidden="true">{article.rank}</span>
    <div className="top-articles-main">
      {url
        ? <a className="top-articles-headline" href={url} target="_blank" rel="noopener noreferrer">
          {article.headline} <span aria-hidden="true">↗</span><span className="visually-hidden"> (opens in a new tab)</span>
        </a>
        : <span className="top-articles-headline">{article.headline}</span>}
      <div className="top-articles-meta">{articleMeta(article.outlet, article.published_at)}</div>
    </div>
    <span className={`top-articles-pill ${article.label}`}>{label}</span>
    <div className="top-articles-weight" aria-label={`${share} of the reading's weight`}>
      <strong>{share}</strong><span aria-hidden="true">of weight</span>
      <div className="top-articles-meter" aria-hidden="true"><i style={{ width: `${heaviest > 0 ? Math.round((article.share / heaviest) * 100) : 0}%` }} /></div>
    </div>
  </li>;
}
