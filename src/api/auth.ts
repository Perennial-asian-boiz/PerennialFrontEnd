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
const PENDING_FLOW_KEY = "perennial.pending_flow";
const CHALLENGE_EXPIRES_AT_KEY = "perennial.challenge_expires_at";
const RECOVERY_ONLY_KEY = "perennial.recovery_only";
const USER_CACHE_KEY = "perennial.user_cache";
const PREFERENCES_CACHE_KEY = "perennial.preferences_cache";
const NOTIFICATION_SETTINGS_CACHE_KEY = "perennial.notification_settings_cache";

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

  // Account endpoints are mounted under /v1; keep VITE_API_URL at the host
  // root because the dashboard's legacy endpoint is still /api/watchlist.
  const response = await fetch(`${getApiBaseUrl()}/v1${path}`, { ...init, headers });
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

export function isRecoverySession() {
  return Boolean(getSessionToken()) && sessionStorage.getItem(RECOVERY_ONLY_KEY) === "1";
}

export function clearSession() {
  sessionGeneration += 1;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(RECOVERY_ONLY_KEY);
  sessionStorage.removeItem(USER_CACHE_KEY);
  sessionStorage.removeItem(PREFERENCES_CACHE_KEY);
  sessionStorage.removeItem(NOTIFICATION_SETTINGS_CACHE_KEY);
  window.dispatchEvent(new Event("perennial-auth-changed"));
}

export function getCachedUser(): User | null {
  try {
    const user = JSON.parse(sessionStorage.getItem(USER_CACHE_KEY) ?? "null") as Partial<User> | null;
    return user && typeof user.id === "string" && typeof user.email === "string"
      && typeof user.full_name === "string" && typeof user.is_verified === "boolean"
      && typeof user.onboarding_completed === "boolean" ? user as User : null;
  } catch {
    return null;
  }
}

export function cacheUser(user: User) {
  sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
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

export function hasPendingLoginCode(email: string) {
  return Boolean(
    getPendingChallenge()
    && getPendingEmail() === email.trim().toLowerCase()
    && sessionStorage.getItem(PENDING_FLOW_KEY) === "login"
    && Number(sessionStorage.getItem(CHALLENGE_EXPIRES_AT_KEY)) > Date.now()
  );
}

export function getResendSeconds() {
  return Math.max(0, Math.ceil((Number(sessionStorage.getItem(RESEND_AT_KEY)) - Date.now()) / 1000));
}

function clearChallenge() {
  clearPendingEmail();
  sessionStorage.removeItem(CHALLENGE_KEY);
  sessionStorage.removeItem(RESEND_AT_KEY);
  sessionStorage.removeItem(PENDING_FLOW_KEY);
  sessionStorage.removeItem(CHALLENGE_EXPIRES_AT_KEY);
  sessionStorage.removeItem("perennial.pending_auth_flow");
  sessionStorage.removeItem("perennial.pending_code"); // Retired development OTP.
}

function saveChallenge(email: string, response: ChallengeResponse) {
  setPendingEmail(email.trim().toLowerCase());
  sessionStorage.setItem(CHALLENGE_KEY, response.challenge_id);
  sessionStorage.setItem(RESEND_AT_KEY, String(Date.now() + response.resend_after_seconds * 1000));
  sessionStorage.setItem(PENDING_FLOW_KEY, response.flow);
  sessionStorage.setItem(CHALLENGE_EXPIRES_AT_KEY, String(Date.now() + 15 * 60 * 1000));
  return response;
}

function storeTokens(accessToken: string, refreshToken: string, flow: AuthResponse["flow"]) {
  sessionGeneration += 1;
  sessionStorage.setItem(SESSION_KEY, accessToken);
  sessionStorage.setItem(REFRESH_KEY, refreshToken);
  if (flow === "recovery") sessionStorage.setItem(RECOVERY_ONLY_KEY, "1");
  else sessionStorage.removeItem(RECOVERY_ONLY_KEY);
  window.dispatchEvent(new Event("perennial-auth-changed"));
}

function saveSession(response: AuthResponse) {
  storeTokens(response.access_token, response.refresh_token, response.flow);
  cacheUser(response.user);
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

export function acceptRecoveryLink(accessToken: string, refreshToken: string) {
  return request<{ recovery_ready: boolean }>("/auth/accept-recovery-link", {
    method: "POST", body: JSON.stringify({ access_token: accessToken }),
  }).then((response) => {
    if (!response.recovery_ready) throw new AuthApiError(400, "This reset link is invalid or expired.");
    clearChallenge();
    storeTokens(accessToken, refreshToken, "recovery");
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
  return request<{ message: string }>("/auth/forgot-password", {
    method: "POST", body: JSON.stringify({ email }),
  }).then(() => { clearChallenge(); });
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

export function getCachedPreferences(): Preferences | null {
  try {
    const preferences = JSON.parse(sessionStorage.getItem(PREFERENCES_CACHE_KEY) ?? "null") as Partial<Preferences> | null;
    return preferences && Array.isArray(preferences.sectors)
      && preferences.sectors.every((sector) => typeof sector === "string")
      && (preferences.risk_level === null || preferences.risk_level === "Conservative" || preferences.risk_level === "Moderate" || preferences.risk_level === "High")
      ? preferences as Preferences : null;
  } catch {
    return null;
  }
}

export function getPreferences(token = getSessionToken()) {
  return request<Preferences>("/me/preferences", {}, token ?? undefined).then((preferences) => {
    sessionStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(preferences));
    return preferences;
  });
}

export function savePreferences(preferences: Preferences, token = getSessionToken()) {
  return request<Preferences>("/me/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences),
  }, token ?? undefined).then((savedPreferences) => {
    sessionStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(savedPreferences));
    return savedPreferences;
  });
}

export function getCachedNotificationSettings(): NotificationSettings | null {
  try {
    const settings = JSON.parse(sessionStorage.getItem(NOTIFICATION_SETTINGS_CACHE_KEY) ?? "null") as Partial<NotificationSettings> | null;
    return settings && typeof settings.confidence_score_enabled === "boolean"
      && typeof settings.earnings_alerts_enabled === "boolean" ? settings as NotificationSettings : null;
  } catch {
    return null;
  }
}

export function getNotificationSettings(token = getSessionToken()) {
  return request<NotificationSettings>("/me/notifications", {}, token ?? undefined).then((settings) => {
    sessionStorage.setItem(NOTIFICATION_SETTINGS_CACHE_KEY, JSON.stringify(settings));
    return settings;
  });
}

export function saveNotificationSettings(settings: NotificationSettings, token = getSessionToken()) {
  return request<NotificationSettings>("/me/notifications", {
    method: "PUT",
    body: JSON.stringify(settings),
  }, token ?? undefined).then((savedSettings) => {
    sessionStorage.setItem(NOTIFICATION_SETTINGS_CACHE_KEY, JSON.stringify(savedSettings));
    return savedSettings;
  });
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
