// GET /v1/securities/{symbol}/score (S2-01..03): the Confidence Score, its breakdown and why
// Perennial recommends the company. Contract: the backend's docs/technical-specs/API.md.

export type ComponentRecord = {
  table: string;
  id: number;
};

export type ScoreComponent = {
  name: string;
  status: "ok" | "unavailable";
  value: number | null;
  nominal_weight: number;
  weight: number;
  contribution: number;
  input_as_of: string | null;
  input_version: string | null;
  record: ComponentRecord | null;
  note?: string;
};

export type Score = {
  status: "ok" | "unavailable";
  reason?: string;
  value: number | null;
  score_version: string | null;
  as_of: string | null;
  recommended: boolean;
  components: ScoreComponent[];
  missing: string[];
};

export type ClaimRecord = {
  table: string;
  id: number;
  batch_id: number;
};

export type Claim = {
  order: number;
  text: string;
  component: string;
  measure: string;
  record: ClaimRecord;
  as_of: string;
  value: string;
};

export type Explanation = {
  status: "ok" | "not_recommended" | "unavailable";
  reason?: string;
  template_version?: string;
  as_of?: string;
  claims: Claim[];
};

export type ScoreResponse = {
  api_version: string;
  symbol: string;
  score: Score;
  explanation: Explanation;
};

export class ScoreApiError extends Error {
  status: number | null;
  code: string | null;

  constructor(message: string, status: number | null, code: string | null = null) {
    super(message);
    this.name = "ScoreApiError";
    this.status = status;
    this.code = code;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Enough of the shape to know it's a score body, not another route's or a proxy's page.
function isScoreResponse(value: unknown): value is ScoreResponse {
  if (!isObject(value) || typeof value.symbol !== "string") return false;
  const { score, explanation } = value;
  return isObject(score)
    && (score.status === "ok" || score.status === "unavailable")
    && (score.value === null || typeof score.value === "number")
    && Array.isArray(score.components)
    && Array.isArray(score.missing)
    && isObject(explanation)
    && typeof explanation.status === "string"
    && Array.isArray(explanation.claims);
}

export async function loadScore(symbol: string, signal?: AbortSignal): Promise<ScoreResponse> {
  const baseUrl = import.meta.env.VITE_API_URL?.trim();
  if (!baseUrl) throw new ScoreApiError("Score API is not configured.", null);

  // A cancelled request rejects with fetch's own AbortError, so callers can ignore it.
  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/v1/securities/${encodeURIComponent(symbol)}/score`,
    { signal },
  );
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch (caught) {
    // Not JSON: payload stays null, and it's refused below.
    if (caught instanceof DOMException && caught.name === "AbortError") throw caught;
  }
  if (!response.ok) {
    const code = isObject(payload) && typeof payload.code === "string" ? payload.code : null;
    throw new ScoreApiError(`Score API returned ${response.status}`, response.status, code);
  }
  if (!isScoreResponse(payload)) {
    throw new ScoreApiError("Score API returned an invalid response.", response.status);
  }
  return payload;
}

export type ScoreState =
  | { kind: "loading" }
  | { kind: "scored"; score: Score; explanation: Explanation }
  | { kind: "unavailable"; reason: string | undefined; label: string; explanation: Explanation }
  | { kind: "not_found"; label: string }
  | { kind: "error"; label: string };

export function scoreState(response: ScoreResponse | null, error?: unknown): ScoreState {
  if (error) {
    if (error instanceof ScoreApiError && error.status === 404) {
      return { kind: "not_found", label: "No score: this company isn't in Perennial yet" };
    }
    return { kind: "error", label: "The score couldn't be loaded. Please try again." };
  }
  if (!response) return { kind: "loading" };
  if (response.score.status === "ok") {
    return { kind: "scored", score: response.score, explanation: response.explanation };
  }
  return {
    kind: "unavailable",
    reason: response.score.reason,
    label: "Score unavailable",
    explanation: response.explanation,
  };
}
