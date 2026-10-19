import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// GitHub Pages returns unknown routes to 404.html. Restore the original
// client-side route before React mounts, preserving Supabase callback tokens.
const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");
const fallbackRoute = new URLSearchParams(window.location.search).get("p");
if (fallbackRoute !== null) {
  const original = new URL(fallbackRoute, window.location.origin);
  const route = original.pathname.replace(/^\/+/, "");
  window.history.replaceState(
    window.history.state,
    "",
    `${appBase}/${route}${original.search}${window.location.hash}`,
  );
}

// Supabase's default Site URL may be the app root. Route email results before
// mounting protected pages; normal hashes such as #risk-comfort are untouched.
const emailResult = new URLSearchParams(window.location.hash.slice(1));
const emailQuery = new URLSearchParams(window.location.search);
const appPath = appBase && window.location.pathname.startsWith(appBase)
  ? window.location.pathname.slice(appBase.length) || "/"
  : window.location.pathname;
if (appPath !== "/auth/confirm" && (
  emailResult.has("access_token") || emailResult.has("error_code") ||
  emailQuery.has("access_token") || emailQuery.has("error_code")
)) {
  window.history.replaceState(window.history.state, "", `${appBase}/auth/confirm${window.location.search}${window.location.hash}`);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
