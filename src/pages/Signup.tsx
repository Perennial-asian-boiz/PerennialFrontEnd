import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";
import { AuthApiError, signup } from "../api/auth";

export default function Signup() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmPassword"))) { setError("Passwords do not match."); return; }
    setError("");
    setBusy(true);
    try {
      await signup(String(form.get("email")).trim(), String(form.get("name")).trim(), password);
      navigate("/account-created");
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : "Unable to create your account. Please try again.");
    } finally { setBusy(false); }
  }

  return <AuthShell className="signup-auth-shell"><div className="form-card signup-card">
    <h1>Create your account</h1><p>Get started with Perennial.</p>
    <form className="form-grid" onSubmit={submit}>
      <div className="form-field"><label htmlFor="name">Full Name</label><input id="name" name="name" autoComplete="name" required maxLength={200} placeholder="Enter your full name" /></div>
      <div className="form-field"><label htmlFor="signup-email">Email Address</label><input id="signup-email" name="email" type="email" autoComplete="username" required maxLength={320} placeholder="Enter your email" /></div>
      <div className="form-field"><label htmlFor="signup-password">Password</label><input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={200} placeholder="Create a password" /></div>
      <div className="form-field"><label htmlFor="confirm-password">Confirm Password</label><input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={200} placeholder="Re-enter your password" /></div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="signup-actions"><button className="btn-primary" type="submit" disabled={busy}>{busy ? "Creating account..." : "Create account"}</button></div>
      <p className="signup-login">Already have an account? <button className="inline-link" type="button" onClick={() => navigate("/login")}>Sign in</button></p>
    </form>
  </div></AuthShell>;
}
