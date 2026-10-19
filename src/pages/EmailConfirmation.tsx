import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";
import { acceptRecoveryLink, confirmEmailLink } from "../api/auth";

export default function EmailConfirmation() {
  const navigate = useNavigate();
  const started = useRef<Promise<unknown> | null>(null);
  const [link] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  const [error, setError] = useState("");
  const recovery = link.get("type") === "recovery";

  useEffect(() => {
    let active = true;
    // Tokens must not remain in the address bar/history or become app sessions.
    window.history.replaceState(window.history.state, "", window.location.pathname);
    if (!started.current) {
      const token = link.get("access_token");
      const refreshToken = link.get("refresh_token");
      started.current = token && !link.has("error") && (!recovery || refreshToken)
        ? recovery ? acceptRecoveryLink(token, refreshToken!) : confirmEmailLink(token)
        : Promise.reject(new Error("invalid link"));
    }
    started.current.then(() => {
      if (active) navigate(recovery ? "/reset-password" : "/login", { replace: true, state: recovery ? undefined : { emailConfirmed: true } });
    }).catch(() => {
      if (active) setError(recovery ? "This password reset link is invalid, expired, or already used. Request a new link to try again." : "This confirmation link is invalid, expired, or already used. If you already confirmed your email, you can sign in.");
    });
    return () => { active = false; };
  }, [link, navigate, recovery]);

  return <AuthShell className="account-created-shell"><section className="auth-card auth-result-card account-created-card">
    <h1>{error ? recovery ? "Check your reset link" : "Check your confirmation link" : recovery ? "Opening password reset..." : "Confirming your email..."}</h1>
    {error ? <><p role="alert">{error}</p><div className="account-created-actions"><button className="auth-text-link" onClick={() => navigate(recovery ? "/forgot-password" : "/login", { replace: true })}>← {recovery ? "Request a new link" : "Back to sign in"}</button></div></> : <p role="status">{recovery ? "Please wait. We’ll open the new password form." : "Please wait. We’ll take you back to sign in."}</p>}
  </section></AuthShell>;
}
