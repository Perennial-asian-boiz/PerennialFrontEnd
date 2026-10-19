import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Supabase's default Site URL may be the app root. Route email results before
// mounting protected pages; normal hashes such as #risk-comfort are untouched.
const emailResult = new URLSearchParams(window.location.hash.slice(1));
const emailQuery = new URLSearchParams(window.location.search);
if (window.location.pathname !== "/auth/confirm" && (
  emailResult.has("access_token") || emailResult.has("error_code") ||
  emailQuery.has("access_token") || emailQuery.has("error_code")
)) {
  window.history.replaceState(window.history.state, "", `/auth/confirm${window.location.search}${window.location.hash}`);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
