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

export const affordableCompanies: Company[] = [
  { name: "Rocket Lab USA, Inc.", ticker: "RKLB", price: "$48.78", sector: "Technology", score: 82, change: "+1.24%", sentiment: "Positive", reason: "Strong launch demand and space infrastructure growth" },
  { name: "Palantir", ticker: "PLTR", price: "$43.18", sector: "Technology", score: 76, change: "+0.04%", sentiment: "Neutral", reason: "Growing software adoption with valuation risk" },
  { name: "AST SpaceMobile", ticker: "ASTS", price: "$28.15", sector: "Technology", score: 74, change: "+1.08%", sentiment: "Positive", reason: "Expanding satellite connectivity opportunity" },
  { name: "Pfizer", ticker: "PFE", price: "$27.72", sector: "Healthcare", score: 71, change: "+0.62%", sentiment: "Positive", reason: "Broad healthcare portfolio and recovery potential" },
  { name: "Viatris", ticker: "VTRS", price: "$16.51", sector: "Healthcare", score: 66, change: "+0.02%", sentiment: "Neutral", reason: "Stable generic medicines business" },
  { name: "GSK", ticker: "GSK", price: "$48.13", sector: "Healthcare", score: 78, change: "+0.31%", sentiment: "Positive", reason: "Stable demand across core medicines" },
  { name: "Kraft Heinz", ticker: "KHC", price: "$27.72", sector: "Consumer Staples", score: 73, change: "+0.41%", sentiment: "Positive", reason: "Defensive brands and steady cash flow" },
  { name: "Keurig Dr Pepper", ticker: "KDP", price: "$16.51", sector: "Consumer Staples", score: 69, change: "+0.02%", sentiment: "Neutral", reason: "Broad beverage distribution" },
  { name: "General Mills", ticker: "GIS", price: "$48.13", sector: "Consumer Staples", score: 60, change: "-0.55%", sentiment: "Watch", reason: "Soft volume in a cautious consumer market" },
];

const popularAdditionalCompanies: Company[] = [
  { name: "Johnson & Johnson", ticker: "JNJ", price: "$265.58", sector: "Healthcare", score: 78, change: "-0.42%", sentiment: "Watch", reason: "Defensive strength with near-term pressure" },
  { name: "AbbVie", ticker: "ABBV", price: "$257.12", sector: "Healthcare", score: 84, change: "+1.18%", sentiment: "Positive", reason: "Strong specialty-care portfolio" },
  { name: "Merck & Co Inc", ticker: "MRK", price: "$143.93", sector: "Healthcare", score: 73, change: "-0.28%", sentiment: "Watch", reason: "Pipeline transition remains important" },
  { name: "Procter & Gamble Co", ticker: "PG", price: "$145.27", sector: "Consumer Staples", score: 81, change: "+0.54%", sentiment: "Positive", reason: "Stable demand across trusted brands" },
  { name: "Coca-Cola Co", ticker: "KO", price: "$88.29", sector: "Consumer Staples", score: 79, change: "+0.36%", sentiment: "Positive", reason: "Consistent global consumer demand" },
  { name: "PepsiCo Inc", ticker: "PEP", price: "$136.32", sector: "Consumer Staples", score: 75, change: "-0.21%", sentiment: "Watch", reason: "Volume softness across key categories" },
];

const popularCoreCompanies: Company[] = [
  { name: "Microsoft Corp", ticker: "MSFT", price: "$495.63", sector: "Technology", score: 82, change: "+0.04%", sentiment: "Neutral", reason: "Cloud growth and resilient margins" },
  { name: "Apple Inc", ticker: "AAPL", price: "$332.27", sector: "Technology", score: 79, change: "+1.15%", sentiment: "Positive", reason: "Strong ecosystem and services growth" },
  { name: "NVIDIA Corp", ticker: "NVDA", price: "$214.17", sector: "Technology", score: 87, change: "+4.28%", sentiment: "Positive", reason: "Strong AI infrastructure demand" },
];

export const popularCompanies = [
  ...popularCoreCompanies,
  ...popularAdditionalCompanies,
];
export const allCompanies = [...affordableCompanies, ...popularCompanies, ...companies].filter((company, index, list) => list.findIndex((item) => item.ticker === company.ticker) === index);

export const topics = ["Technology", "Healthcare", "Financial Services", "Consumer", "Energy", "Industrials", "AI & Robotics", "Climate", "Travel", "Media"];

export const insights = [
  { category: "Market pulse", title: "AI infrastructure remains the strongest theme", text: "Capital is continuing to move toward semiconductors, cloud platforms, and enterprise automation.", time: "Today" },
  { category: "Your watchlist", title: "NVIDIA score moved up 3 points", text: "Positive earnings momentum and sector strength improved the company’s confidence score.", time: "Yesterday" },
  { category: "Learn", title: "What does sentiment mean?", text: "Sentiment combines recent news, market movement, and analyst signals into one readable view.", time: "2 days ago" },
];
