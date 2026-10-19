import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";
import { acceptRecoveryLink, confirmEmailLink } from "../api/auth";

function hasRecoveryClaim(token: string | null) {
  if (!token) return false;
  try {
    const payload = token.split(".")[1];
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { amr?: unknown };
    return Array.isArray(claims.amr) && claims.amr.some(
      (entry) => entry && typeof entry === "object" && "method" in entry && entry.method === "recovery",
    );
  } catch {
    return false;
  }
}

export default function EmailConfirmation() {
  const navigate = useNavigate();
  const started = useRef<Promise<unknown> | null>(null);
  const [link] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const token = hash.get("access_token") ?? query.get("access_token");
    return {
      token,
      refreshToken: hash.get("refresh_token") ?? query.get("refresh_token"),
      failed: hash.has("error") || hash.has("error_code") || query.has("error") || query.has("error_code"),
      recovery: hash.get("type") === "recovery" || query.get("type") === "recovery" || hasRecoveryClaim(token),
    };
  });
  const [error, setError] = useState("");
  const recovery = link.recovery;

  useEffect(() => {
    let active = true;
    // Tokens must not remain in the address bar/history or become app sessions.
    window.history.replaceState(window.history.state, "", window.location.pathname);
    if (!started.current) {
      started.current = link.token && !link.failed && (!recovery || link.refreshToken)
        ? recovery ? acceptRecoveryLink(link.token, link.refreshToken!) : confirmEmailLink(link.token)
        : Promise.reject(new Error("invalid link"));
    }
    started.current.then(() => {
      if (active) navigate(recovery ? "/reset-password" : "/login", { replace: true, state: recovery ? undefined : { emailConfirmed: true } });
    }).catch(() => {
      if (active) setError(recovery ? "This password reset link is invalid, expired, or already used. Request a new link to try again." : "This email link is invalid, expired, or already used.");
    });
    return () => { active = false; };
  }, [link, navigate, recovery]);

  return <AuthShell className="account-created-shell"><section className="auth-card auth-result-card account-created-card">
    <h1>{error ? recovery ? "Check your reset link" : "Check your email link" : recovery ? "Opening password reset..." : "Confirming your email..."}</h1>
    {error ? <><p role="alert">{error}</p><div className="account-created-actions"><button className="auth-text-link" onClick={() => navigate("/forgot-password", { replace: true })}>Request a new reset link</button><button className="auth-text-link" onClick={() => navigate("/login", { replace: true })}>← Back to sign in</button></div></> : <p role="status">{recovery ? "Please wait. We’ll open the new password form." : "Please wait. We’ll take you back to sign in."}</p>}
  </section></AuthShell>;
}
