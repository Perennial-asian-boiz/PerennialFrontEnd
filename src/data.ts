export type Company = {
  name: string;
  ticker: string;
  price: string;
  sector: string;
  score: number;
  change: string;
  sentiment: "Positive" | "Neutral" | "Watch";
  reason: string;
};

export type SignalStatus = "up" | "neutral" | "down";

export function getSignalStatus(company: Company): SignalStatus {
  if (company.change.startsWith("-")) return "down";
  if (company.sentiment === "Neutral") return "neutral";
  return "up";
}

export const companies: Company[] = [
  { name: "NVIDIA", ticker: "NVDA", price: "$214.17", sector: "Technology", score: 87, change: "+4.28%", sentiment: "Positive", reason: "Strong AI infrastructure demand" },
  { name: "Microsoft", ticker: "MSFT", price: "$496.03", sector: "Technology", score: 82, change: "+1.64%", sentiment: "Positive", reason: "Cloud growth and resilient margins" },
  { name: "Costco", ticker: "COST", price: "$948.13", sector: "Consumer Staples", score: 74, change: "+0.82%", sentiment: "Neutral", reason: "Consistent membership-led growth" },
  { name: "Tesla", ticker: "TSLA", price: "$248.98", sector: "Automotive", score: 61, change: "-1.12%", sentiment: "Watch", reason: "Volatility around delivery outlook" },
  { name: "Apple", ticker: "AAPL", price: "$233.27", sector: "Technology", score: 79, change: "+1.15%", sentiment: "Positive", reason: "Strong ecosystem and services growth" },
  { name: "Eli Lilly", ticker: "LLY", price: "$626.50", sector: "Healthcare", score: 76, change: "-0.82%", sentiment: "Watch", reason: "Pipeline strength with valuation risk" },
  { name: "Vertex", ticker: "VRTX", price: "$527.12", sector: "Healthcare", score: 72, change: "+0.67%", sentiment: "Positive", reason: "Durable specialty-care portfolio" },
  { name: "GSK", ticker: "GSK", price: "$143.93", sector: "Healthcare", score: 68, change: "-0.31%", sentiment: "Neutral", reason: "Stable demand across core medicines" },
  { name: "Kraft Heinz", ticker: "KHC", price: "$37.72", sector: "Consumer Staples", score: 65, change: "+0.41%", sentiment: "Neutral", reason: "Defensive brands and steady cash flow" },
  { name: "Keurig Dr Pepper", ticker: "KDP", price: "$31.61", sector: "Consumer Staples", score: 63, change: "+0.28%", sentiment: "Neutral", reason: "Broad beverage distribution" },
  { name: "General Mills", ticker: "GIS", price: "$48.13", sector: "Consumer Staples", score: 60, change: "-0.55%", sentiment: "Watch", reason: "Soft volume in a cautious consumer market" },
];

export const topics = ["Technology", "Healthcare", "Financial Services", "Consumer", "Energy", "Industrials", "AI & Robotics", "Climate", "Travel", "Media"];

export const insights = [
  { category: "Market pulse", title: "AI infrastructure remains the strongest theme", text: "Capital is continuing to move toward semiconductors, cloud platforms, and enterprise automation.", time: "Today" },
  { category: "Your watchlist", title: "NVIDIA score moved up 3 points", text: "Positive earnings momentum and sector strength improved the company’s confidence score.", time: "Yesterday" },
  { category: "Learn", title: "What does sentiment mean?", text: "Sentiment combines recent news, market movement, and analyst signals into one readable view.", time: "2 days ago" },
];
