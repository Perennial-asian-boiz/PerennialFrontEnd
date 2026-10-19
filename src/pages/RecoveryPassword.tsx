import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";
import { AuthApiError, clearSession, isRecoverySession, resetPassword } from "../api/auth";
import PasswordRequirements from "../components/PasswordRequirements";
import { isPasswordValid, passwordRequirementsMessage } from "../lib/passwordRequirements";

export default function RecoveryPassword() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [openedWithRecovery] = useState(isRecoverySession);
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (!isPasswordValid(password)) { setError(passwordRequirementsMessage()); return; }
    if (password !== String(form.get("confirmPassword"))) { setError("Passwords do not match."); return; }
    setBusy(true); setError("");
    try { await resetPassword(password); setComplete(true); }
    catch (caught) { setError(caught instanceof AuthApiError ? caught.message : "Unable to reset your password."); }
    finally { setBusy(false); }
  }
  if (!complete && !openedWithRecovery) return <Navigate to="/forgot-password" replace />;
  return <AuthShell><div className="auth-card recovery-card">
    {complete ? <><h1>Password reset successfully</h1><p>Sign in with your new password.</p><button className="auth-text-link" type="button" onClick={() => navigate("/login", { replace: true })}>← Back to sign in</button></> : <>
      <h1>Reset password</h1><p>Choose a new password for your account.</p>
      <form className="form-grid" onSubmit={submit} noValidate>
        <div className="form-field password-field-with-popover"><label htmlFor="recovery-password">New Password</label><div className="password-input-anchor"><input id="recovery-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)} aria-describedby={passwordFocused ? "password-requirements" : undefined} /><PasswordRequirements password={password} visible={passwordFocused} /></div></div>
        <div className="form-field"><label htmlFor="recovery-confirm">Confirm Password</label><input id="recovery-confirm" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={200} /></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="btn-primary auth-submit" disabled={busy}>{busy ? "Saving..." : "Reset password"}</button>
      </form>
      <button className="auth-text-link" type="button" disabled={busy} onClick={() => { clearSession(); navigate("/login", { replace: true }); }}>← Back to sign in</button>
    </>}
  </div></AuthShell>;
}
