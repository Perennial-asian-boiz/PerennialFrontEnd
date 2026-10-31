// Local mock of the backend routes the company page calls, for building the score card
// (S2-01) and why-panel (S2-03) before GET /v1/securities/{symbol}/score is deployed.
// Plain Node, no packages:
//
//   npm run mock-api                       # http://localhost:8787
//   VITE_API_URL=http://localhost:8787     # in .env.local, then npm run dev
//
// Routes: GET /api/watchlist (the dashboard), GET /v1/securities/{symbol} (company
// details) and GET /v1/securities/{symbol}/score (backend #77's contract). Each ticker in
// the fixtures file is one state; an unknown ticker is 404 unknown_security, as the API
// does. The fixtures are re-read on every request, so edits show up without a restart.
// MOCK_FIXTURES points at another fixtures file; MOCK_DELAY_MS slows every response.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.MOCK_API_PORT ?? 8787);
const DELAY_MS = Number(process.env.MOCK_DELAY_MS ?? 0);
const FIXTURES = process.env.MOCK_FIXTURES
  ?? fileURLToPath(new URL("./mock-score-fixtures.json", import.meta.url));
const AS_OF = "2026-11-05T17:02:11+00:00";

const UNKNOWN = { detail: "no security has that ticker", code: "unknown_security" };

async function securities() {
  return JSON.parse(await readFile(FIXTURES, "utf8")).securities;
}

function security(symbol, entry) {
  return {
    symbol,
    name: entry.name ?? null,
    sector: entry.sector ?? null,
    summary: entry.summary
      ? { text: entry.summary, source: { name: "Mock fixture", url: "https://example.invalid/" }, as_of: AS_OF }
      : null,
  };
}

function dashboardRow(symbol, entry) {
  return {
    name: entry.name ?? symbol,
    ticker: symbol,
    sector: entry.sector ?? "Unclassified",
    price: null,
    change_percent: null,
    confidence_score: entry.score?.value ?? null,
    sentiment: "Neutral",
    reason: entry.summary ?? null,
  };
}

async function route(path) {
  const all = await securities();
  if (path === "/api/watchlist") {
    const rows = Object.entries(all).map(([symbol, entry]) => dashboardRow(symbol, entry));
    const half = Math.ceil(rows.length / 2);
    return [200, {
      schema_version: "1.0",
      generated_at: AS_OF,
      affordable_growing: rows.slice(0, half),
      popular_stable: rows.slice(half),
    }];
  }
  const match = path.match(/^\/v1\/securities\/([^/]+)(\/score)?$/);
  if (!match) return [404, { detail: "Not Found" }];
  const symbol = decodeURIComponent(match[1]).trim().toUpperCase();
  const entry = all[symbol];
  if (!entry) return [404, UNKNOWN];
  if (!match[2]) return [200, { api_version: "v1", security: security(symbol, entry) }];
  if (entry.status) return [entry.status, entry.body];
  return [200, { api_version: "v1", symbol, score: entry.score, explanation: entry.explanation }];
}

createServer(async (request, response) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Cache-Control": "no-cache",
  };
  if (request.method === "OPTIONS") {
    response.writeHead(204, headers).end();
    return;
  }
  let status = 405;
  let body = { detail: "method not allowed" };
  if (request.method === "GET") {
    try {
      [status, body] = await route(new URL(request.url, "http://mock").pathname);
    } catch (caught) {
      [status, body] = [500, { detail: `mock failed: ${caught.message}`, code: "internal_error" }];
    }
  }
  if (DELAY_MS > 0) await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  response.writeHead(status, { ...headers, "Content-Type": "application/json" }).end(JSON.stringify(body));
  console.log(`${request.method} ${request.url} -> ${status}`);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`mock API on http://localhost:${PORT} (fixtures: ${FIXTURES})`);
});
