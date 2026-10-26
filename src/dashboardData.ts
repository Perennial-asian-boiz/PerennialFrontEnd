import type { Company } from "./data";
import { topics } from "./data";

export type DashboardBucket = "affordable_growing" | "popular_stable";

export type DashboardPayload = Record<DashboardBucket, Company[]>;

export const emptyDashboardPayload: DashboardPayload = {
  affordable_growing: [],
  popular_stable: [],
};

type SectorSeed = {
  affordable: [string, string][];
  popular: [string, string][];
};

// This is the frontend fixture for the backend contract. The backend can later
// return the same two buckets without requiring changes to the dashboard UI.
const sectorSeeds: Record<string, SectorSeed> = {
  Technology: {
    affordable: [["Palantir", "PLTR"], ["CrowdStrike", "CRWD"], ["Snowflake", "SNOW"]],
    popular: [["Microsoft", "MSFT"], ["Apple", "AAPL"], ["NVIDIA", "NVDA"]],
  },
  Financials: {
    affordable: [["SoFi Technologies", "SOFI"], ["Affirm", "AFRM"], ["Robinhood", "HOOD"]],
    popular: [["JPMorgan Chase", "JPM"], ["Visa", "V"], ["Goldman Sachs", "GS"]],
  },
  Healthcare: {
    affordable: [["Pfizer", "PFE"], ["Viatris", "VTRS"], ["Hims & Hers Health", "HIMS"]],
    popular: [["Johnson & Johnson", "JNJ"], ["AbbVie", "ABBV"], ["Merck", "MRK"]],
  },
  Industrials: {
    affordable: [["Blade Air Mobility", "BLDE"], ["GATX", "GATX"], ["RXO", "RXO"]],
    popular: [["Caterpillar", "CAT"], ["Honeywell", "HON"], ["GE Aerospace", "GE"]],
  },
  "Consumer Discretionary": {
    affordable: [["Etsy", "ETSY"], ["Wayfair", "W"], ["Rivian", "RIVN"]],
    popular: [["Amazon", "AMZN"], ["Home Depot", "HD"], ["McDonald's", "MCD"]],
  },
  "Consumer Staples": {
    affordable: [["Kraft Heinz", "KHC"], ["Keurig Dr Pepper", "KDP"], ["General Mills", "GIS"]],
    popular: [["Procter & Gamble", "PG"], ["Coca-Cola", "KO"], ["PepsiCo", "PEP"]],
  },
  Energy: {
    affordable: [["Occidental Petroleum", "OXY"], ["Plug Power", "PLUG"], ["Marathon Oil", "MRO"]],
    popular: [["Exxon Mobil", "XOM"], ["Chevron", "CVX"], ["ConocoPhillips", "COP"]],
  },
  Utilities: {
    affordable: [["NRG Energy", "NRG"], ["AES", "AES"], ["Pinnacle West", "PNW"]],
    popular: [["Duke Energy", "DUK"], ["Southern Company", "SO"], ["American Electric Power", "AEP"]],
  },
  Materials: {
    affordable: [["Alcoa", "AA"], ["Cleveland-Cliffs", "CLF"], ["Eldorado Gold", "EGO"]],
    popular: [["Linde", "LIN"], ["Sherwin-Williams", "SHW"], ["Nucor", "NUE"]],
  },
  "Communication Services": {
    affordable: [["Snap", "SNAP"], ["Roku", "ROKU"], ["Paramount Global", "PARA"]],
    popular: [["Alphabet", "GOOGL"], ["Meta Platforms", "META"], ["Netflix", "NFLX"]],
  },
  "Real Estate": {
    affordable: [["Opendoor", "OPEN"], ["UWM Holdings", "UWMC"], ["Redfin", "RDFN"]],
    popular: [["Prologis", "PLD"], ["American Tower", "AMT"], ["Realty Income", "O"]],
  },
};

function createCompany(
  sector: string,
  [name, ticker]: [string, string],
  index: number,
  bucket: DashboardBucket,
): Company {
  const score = bucket === "affordable_growing" ? 72 + ((index * 5) % 16) : 78 + ((index * 3) % 12);
  const change = bucket === "affordable_growing" ? `+${(0.42 + (index % 5) * 0.27).toFixed(2)}%` : `+${(0.18 + (index % 4) * 0.16).toFixed(2)}%`;

  return {
    name,
    ticker,
    price: `$${(24.5 + (index % 9) * 18.35).toFixed(2)}`,
    sector,
    score,
    change,
    sentiment: index % 4 === 0 ? "Neutral" : "Positive",
    reason: bucket === "affordable_growing" ? `Growth signals are improving across ${sector.toLowerCase()}.` : `Established market position in ${sector.toLowerCase()}.`,
  };
}

function buildBucket(bucket: DashboardBucket): Company[] {
  return topics.flatMap((sector) => sectorSeeds[sector][bucket === "affordable_growing" ? "affordable" : "popular"].map((company, index) => createCompany(sector, company, index, bucket)));
}

export const dashboardPayload: DashboardPayload = {
  affordable_growing: buildBucket("affordable_growing"),
  popular_stable: buildBucket("popular_stable"),
};

// Keep the same company record when a dashboard row is opened in Watchlist.
// The first occurrence wins if a ticker appears in both backend buckets.
export const dashboardCompanies = [...dashboardPayload.affordable_growing, ...dashboardPayload.popular_stable].filter((company, index, companies) => companies.findIndex((item) => item.ticker === company.ticker) === index);

export function getDashboardSections(payload: DashboardPayload, selectedSectors: string[], bucket: DashboardBucket) {
  return selectedSectors.map((name) => ({
    name,
    items: payload[bucket].filter((company) => company.sector === name),
  }));
}
