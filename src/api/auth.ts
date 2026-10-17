/**
 * Small client for the Sprint 1 backend account API.
 *
 * The existing auth screens can call these functions directly. There is no
 * global auth framework here: the opaque session token is kept in
 * sessionStorage and sent as a Bearer token for account-owned data.
 */

const SESSION_KEY = "perennial.access_token";
const PENDING_EMAIL_KEY = "perennial.pending_email";
const PENDING_CODE_KEY = "perennial.pending_code";

export type User = {
  id: number;
  email: string;
  full_name: string;
  is_verified: boolean;
};

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user: User;
};

export type SignupResponse = {
  user: User;
  verification_required: boolean;
  development_code: string | null;
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

export class AuthApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

function getApiBaseUrl() {
  const value = import.meta.env.VITE_API_URL?.trim();
  if (!value) throw new Error("VITE_API_URL is not configured.");
  return value.replace(/\/$/, "");
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
  const body = await response.json().catch(() => null) as { detail?: string } | T | null;
  if (!response.ok) {
    const message = body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
      ? body.detail
      : "The request could not be completed.";
    throw new AuthApiError(response.status, message);
  }
  return body as T;
}

export function getSessionToken() {
  return sessionStorage.getItem(SESSION_KEY);
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
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

export function getPendingDevelopmentCode() {
  return sessionStorage.getItem(PENDING_CODE_KEY) ?? "";
}

export function setPendingDevelopmentCode(code: string | null) {
  if (code) sessionStorage.setItem(PENDING_CODE_KEY, code);
  else sessionStorage.removeItem(PENDING_CODE_KEY);
}

export function clearPendingDevelopmentCode() {
  sessionStorage.removeItem(PENDING_CODE_KEY);
}

function saveSession(response: AuthResponse) {
  sessionStorage.setItem(SESSION_KEY, response.access_token);
  window.dispatchEvent(new Event("perennial-auth-changed"));
  return response;
}

export function signup(email: string, fullName: string, password: string) {
  return request<SignupResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, full_name: fullName, password }),
  });
}

export function verifyOtp(email: string, code: string) {
  return request<AuthResponse>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  }).then(saveSession);
}

export function resendOtp(email: string) {
  return request<{ verification_required: boolean; development_code: string | null }>("/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function login(email: string, password: string) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }).then(saveSession);
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
