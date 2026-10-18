import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";
import { confirmEmailLink } from "../api/auth";

export default function EmailConfirmation() {
  const navigate = useNavigate();
  const started = useRef<Promise<unknown> | null>(null);
  const [link] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    // Tokens must not remain in the address bar/history or become app sessions.
    window.history.replaceState(window.history.state, "", window.location.pathname);
    if (!started.current) {
      const token = link.get("access_token");
      started.current = token && !link.has("error")
        ? confirmEmailLink(token)
        : Promise.reject(new Error("invalid link"));
    }
    started.current.then(() => {
      if (active) navigate("/login", { replace: true, state: { emailConfirmed: true } });
    }).catch(() => {
      if (active) setError("This confirmation link is invalid, expired, or already used. If you already confirmed your email, you can sign in.");
    });
    return () => { active = false; };
  }, [link, navigate]);

  return <AuthShell className="account-created-shell"><section className="auth-card auth-result-card account-created-card">
    <h1>{error ? "Check your confirmation link" : "Confirming your email..."}</h1>
    {error ? <><p role="alert">{error}</p><div className="account-created-actions"><button className="auth-text-link" onClick={() => navigate("/login", { replace: true })}>← Back to sign in</button></div></> : <p role="status">Please wait. We’ll take you back to sign in.</p>}
  </section></AuthShell>;
}
