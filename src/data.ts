export type Company = {
  name: string;
  ticker: string;
  sector: string;
  score: number;
  change: string;
  sentiment: "Positive" | "Neutral" | "Watch";
  reason: string;
};

export const companies: Company[] = [
  { name: "NVIDIA", ticker: "NVDA", sector: "Technology", score: 87, change: "+4.28%", sentiment: "Positive", reason: "Strong AI infrastructure demand" },
  { name: "Microsoft", ticker: "MSFT", sector: "Technology", score: 82, change: "+1.64%", sentiment: "Positive", reason: "Cloud growth and resilient margins" },
  { name: "Costco", ticker: "COST", sector: "Consumer Staples", score: 74, change: "+0.82%", sentiment: "Neutral", reason: "Consistent membership-led growth" },
  { name: "Tesla", ticker: "TSLA", sector: "Automotive", score: 61, change: "-1.12%", sentiment: "Watch", reason: "Volatility around delivery outlook" },
];

export const topics = ["Technology", "Healthcare", "Financial Services", "Consumer", "Energy", "Industrials", "AI & Robotics", "Climate", "Travel", "Media"];

export const insights = [
  { category: "Market pulse", title: "AI infrastructure remains the strongest theme", text: "Capital is continuing to move toward semiconductors, cloud platforms, and enterprise automation.", time: "Today" },
  { category: "Your watchlist", title: "NVIDIA score moved up 3 points", text: "Positive earnings momentum and sector strength improved the company’s confidence score.", time: "Yesterday" },
  { category: "Learn", title: "What does sentiment mean?", text: "Sentiment combines recent news, market movement, and analyst signals into one readable view.", time: "2 days ago" },
];
