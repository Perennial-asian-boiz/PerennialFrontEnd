/**
 * Small client for the Sprint 1 backend account API.
 *
 * Tokens live only in this tab's sessionStorage; account data lives in the
 * backend database. Supabase/Resend credentials never enter the frontend.
 */

const SESSION_KEY = "perennial.access_token";
const REFRESH_KEY = "perennial.refresh_token";
const PENDING_EMAIL_KEY = "perennial.pending_email";
const CHALLENGE_KEY = "perennial.pending_challenge";
const RESEND_AT_KEY = "perennial.resend_at";

export type User = {
  id: string;
  email: string;
  full_name: string;
  is_verified: boolean;
  onboarding_completed: boolean;
};

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  flow: "signup" | "login" | "recovery";
  token_type: "bearer";
  user: User;
};

export type ChallengeResponse = {
  challenge_id: string;
  flow: "signup" | "login" | "recovery";
  verification_required: boolean;
  resend_after_seconds: number;
  verification_method: "email_link" | "email_otp";
};

export type Preferences = {
  sectors: string[];
  risk_level: "Conservative" | "Moderate" | "High" | null;
};

export type NotificationSettings = {
  confidence_score_enabled: boolean;
  earnings_alerts_enabled: boolean;
};

export type WatchlistItem = { ticker: string };

export type AuthFieldErrors = Partial<Record<"full_name" | "email" | "password" | "new_password" | "old_password" | "code", string>>;

export class AuthApiError extends Error {
  status: number;
  code?: string;
  fieldErrors: AuthFieldErrors;

  constructor(status: number, message: string, code?: string, fieldErrors: AuthFieldErrors = {}) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function getApiBaseUrl() {
  const value = import.meta.env.VITE_API_URL?.trim();
  if (!value) throw new Error("VITE_API_URL is not configured.");
  return value.replace(/\/$/, "");
}

let refreshing: Promise<AuthResponse> | null = null;
let sessionGeneration = 0;

async function request<T>(path: string, init: RequestInit = {}, token?: string, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
  if (response.status === 401 && token && retry && sessionStorage.getItem(REFRESH_KEY)) {
    // Concurrent account requests share one refresh; never replay a rotated token.
    const latest = getSessionToken();
    if (latest && latest !== token) return request<T>(path, init, latest, false);
    if (!refreshing) {
      const generation = sessionGeneration;
      refreshing = request<AuthResponse>("/auth/refresh", {
        method: "POST", body: JSON.stringify({ refresh_token: sessionStorage.getItem(REFRESH_KEY) }),
      }, undefined, false).then((session) => {
        if (generation !== sessionGeneration) throw new AuthApiError(401, "Session changed. Please sign in again.");
        return saveSession(session);
      }).catch((error: unknown) => {
        if (generation === sessionGeneration && error instanceof AuthApiError && error.status === 401) clearSession();
        throw error;
      }).finally(() => { refreshing = null; });
    }
    const session = await refreshing;
    return request<T>(path, init, session.access_token, false);
  }
  const body = await response.json().catch(() => null) as { detail?: string; code?: unknown; field_errors?: unknown } | T | null;
  if (!response.ok) {
    const message = body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
      ? body.detail
      : "The request could not be completed.";
    const fieldErrors: AuthFieldErrors = {};
    if (body && typeof body === "object" && "field_errors" in body && body.field_errors && typeof body.field_errors === "object") {
      for (const name of ["full_name", "email", "password", "new_password", "old_password", "code"] as const) {
        const value = (body.field_errors as Record<string, unknown>)[name];
        if (typeof value === "string" && value.length <= 500) fieldErrors[name] = value;
      }
    }
    const code = body && typeof body === "object" && "code" in body && typeof body.code === "string" ? body.code : undefined;
    throw new AuthApiError(response.status, message, code, fieldErrors);
  }
  return body as T;
}

export function getSessionToken() {
  return sessionStorage.getItem(SESSION_KEY);
}

export function clearSession() {
  sessionGeneration += 1;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  window.dispatchEvent(new Event("perennial-auth-changed"));
}

export function isAuthApiConfigured() {
  return Boolean(import.meta.env.VITE_API_URL?.trim());
}

export function getPendingEmail() {
  return sessionStorage.getItem(PENDING_EMAIL_KEY) ?? "";
}

export function setPendingEmail(email: string) {
  sessionStorage.setItem(PENDING_EMAIL_KEY, email);
}

export function clearPendingEmail() {
  sessionStorage.removeItem(PENDING_EMAIL_KEY);
}

export function getPendingChallenge() {
  return sessionStorage.getItem(CHALLENGE_KEY) ?? "";
}

export function getResendSeconds() {
  return Math.max(0, Math.ceil((Number(sessionStorage.getItem(RESEND_AT_KEY)) - Date.now()) / 1000));
}

function clearChallenge() {
  clearPendingEmail();
  sessionStorage.removeItem(CHALLENGE_KEY);
  sessionStorage.removeItem(RESEND_AT_KEY);
  sessionStorage.removeItem("perennial.pending_auth_flow");
  sessionStorage.removeItem("perennial.pending_code"); // Retired development OTP.
}

function saveChallenge(email: string, response: ChallengeResponse) {
  setPendingEmail(email);
  sessionStorage.setItem(CHALLENGE_KEY, response.challenge_id);
  sessionStorage.setItem(RESEND_AT_KEY, String(Date.now() + response.resend_after_seconds * 1000));
  return response;
}

function saveSession(response: AuthResponse) {
  sessionGeneration += 1;
  sessionStorage.setItem(SESSION_KEY, response.access_token);
  sessionStorage.setItem(REFRESH_KEY, response.refresh_token);
  window.dispatchEvent(new Event("perennial-auth-changed"));
  return response;
}

export function signup(email: string, fullName: string, password: string) {
  return request<ChallengeResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, full_name: fullName, password }),
  }).then((response) => saveChallenge(email, response));
}

export function confirmEmailLink(accessToken: string) {
  // Confirmed email is NOT an app login. Never save the emailed JWT/refresh token.
  return request<{ email_confirmed: boolean }>("/auth/confirm-email", {
    method: "POST", body: JSON.stringify({ access_token: accessToken }),
  }).then((response) => {
    if (!response.email_confirmed) throw new AuthApiError(400, "Unable to confirm this email.");
    clearChallenge();
    clearSession();
    return response;
  });
}

export function resendConfirmation(email: string) {
  return request<ChallengeResponse>("/auth/resend-confirmation", {
    method: "POST", body: JSON.stringify({ email, challenge_id: getPendingChallenge() }),
  }).then((response) => saveChallenge(email, response));
}

export function verifyOtp(email: string, code: string) {
  return request<AuthResponse>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, code, challenge_id: getPendingChallenge() }),
  }).then((response) => { clearChallenge(); return saveSession(response); });
}

export function resendOtp(email: string) {
  return request<ChallengeResponse>("/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ email, challenge_id: getPendingChallenge() }),
  }).then((response) => saveChallenge(email, response));
}

export function login(email: string, password: string) {
  return request<ChallengeResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }).then((response) => saveChallenge(email, response));
}

export function forgotPassword(email: string) {
  return request<ChallengeResponse>("/auth/forgot-password", {
    method: "POST", body: JSON.stringify({ email }),
  }).then((response) => saveChallenge(email, response));
}

export function resetPassword(newPassword: string) {
  return request<{ message: string }>("/auth/reset-password", {
    method: "POST", body: JSON.stringify({ new_password: newPassword }),
  }, getSessionToken() ?? undefined).then((response) => { clearSession(); return response; });
}

export function logout(token = getSessionToken()) {
  return request<void>("/auth/logout", { method: "POST" }, token ?? undefined);
}

export function getMe(token = getSessionToken()) {
  return request<User>("/me", {}, token ?? undefined);
}

export function getPreferences(token = getSessionToken()) {
  return request<Preferences>("/me/preferences", {}, token ?? undefined);
}

export function savePreferences(preferences: Preferences, token = getSessionToken()) {
  return request<Preferences>("/me/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences),
  }, token ?? undefined);
}

export function getNotificationSettings(token = getSessionToken()) {
  return request<NotificationSettings>("/me/notifications", {}, token ?? undefined);
}

export function saveNotificationSettings(settings: NotificationSettings, token = getSessionToken()) {
  return request<NotificationSettings>("/me/notifications", {
    method: "PUT",
    body: JSON.stringify(settings),
  }, token ?? undefined);
}

export function changePassword(oldPassword: string, newPassword: string, token = getSessionToken()) {
  return request<{ message: string }>("/me/password", {
    method: "PUT",
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  }, token ?? undefined);
}

export function getWatchlist(token = getSessionToken()) {
  return request<WatchlistItem[]>("/me/watchlist", {}, token ?? undefined);
}

export function addToWatchlist(ticker: string, token = getSessionToken()) {
  return request<WatchlistItem>("/me/watchlist", {
    method: "POST",
    body: JSON.stringify({ ticker }),
  }, token ?? undefined);
}

export function removeFromWatchlist(ticker: string, token = getSessionToken()) {
  return request<void>(`/me/watchlist/${encodeURIComponent(ticker)}`, {
    method: "DELETE",
  }, token ?? undefined);
}
