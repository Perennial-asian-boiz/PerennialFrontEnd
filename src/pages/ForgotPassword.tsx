import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";
import { AuthApiError, forgotPassword } from "../api/auth";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    setBusy(true); setError("");
    try { await forgotPassword(email); setSent(true); }
    catch (caught) { setError(caught instanceof AuthApiError ? caught.message : "Unable to send a reset link. Please try again."); }
    finally { setBusy(false); }
  }
  return <AuthShell><div className="auth-card forgot-card"><h1>{sent ? "Check your email" : "Forgot password?"}</h1><p>{sent ? "If an account exists for that address, follow the link in the email to choose a new password." : "Enter your email and we’ll send a password reset link if your account exists."}</p>{!sent && <form className="form-grid" onSubmit={submit}>
    <div className="form-field"><label htmlFor="forgot-email">Email Address</label><input id="forgot-email" name="email" type="email" autoComplete="email" required maxLength={320} placeholder="Enter your email" /></div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="btn-primary auth-submit" type="submit" disabled={busy}>{busy ? "Sending..." : "Send reset link"}</button>
  </form>}<button className="auth-text-link" type="button" onClick={() => navigate("/login")}>← Back to sign in</button></div></AuthShell>;
}
