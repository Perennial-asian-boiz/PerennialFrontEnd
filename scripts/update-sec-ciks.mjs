// Refresh the public SEC ticker/CIK index used only for company filing links.
import { writeFile } from "node:fs/promises";

const source = "https://www.sec.gov/files/company_tickers.json";
const response = await fetch(source, { headers: { "User-Agent": "Perennial/1.0 source-link-index" } });
if (!response.ok) throw new Error(`SEC index request returned ${response.status}`);
const rows = Object.values(await response.json());
const tickers = Object.fromEntries(rows.map(({ ticker, cik_str }) => {
  if (typeof ticker !== "string" || !Number.isSafeInteger(cik_str) || cik_str <= 0) throw new Error("Invalid SEC index row");
  return [ticker, cik_str];
}).sort(([a], [b]) => a.localeCompare(b)));
if (!Object.keys(tickers).length) throw new Error("SEC index is empty");
await writeFile(new URL("../public/sec-company-ciks.json", import.meta.url),
  `${JSON.stringify({ source, retrieved_at: new Date().toISOString(), tickers })}\n`);
console.log(`Updated ${Object.keys(tickers).length} public SEC ticker/CIK mappings.`);
