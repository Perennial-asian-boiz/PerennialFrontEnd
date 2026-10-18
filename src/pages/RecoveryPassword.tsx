import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";
import { AuthApiError, getSessionToken, resetPassword } from "../api/auth";

export default function RecoveryPassword() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmPassword"))) { setError("Passwords do not match."); return; }
    setBusy(true); setError("");
    try { await resetPassword(password); setComplete(true); }
    catch (caught) { setError(caught instanceof AuthApiError ? caught.message : "Unable to reset your password."); }
    finally { setBusy(false); }
  }
  if (!complete && !getSessionToken()) return <Navigate to="/forgot-password" replace />;
  return <AuthShell><div className="auth-card">
    {complete ? <><h1>Password reset successfully</h1><p>Sign in with your new password.</p><button className="btn-primary" onClick={() => navigate("/login", { replace: true })}>Back to sign in</button></> : <>
      <h1>Reset password</h1><p>Choose a new password for your account.</p>
      <form className="form-grid" onSubmit={submit}>
        <div className="form-field"><label htmlFor="recovery-password">New Password</label><input id="recovery-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={200} /></div>
        <div className="form-field"><label htmlFor="recovery-confirm">Confirm Password</label><input id="recovery-confirm" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={200} /></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? "Saving..." : "Reset password"}</button>
      </form>
    </>}
  </div></AuthShell>;
}
