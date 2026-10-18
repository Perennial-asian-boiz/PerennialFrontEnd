import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";
import { AuthApiError, login } from "../api/auth";

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await login(String(form.get("email")).trim(), String(form.get("password")));
      navigate("/verify-code");
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.status === 401 ? "Invalid email or password." : caught.message : "Unable to connect. Please try again.");
    } finally { setBusy(false); }
  }

  return <AuthShell><div className="form-card login-card">
    <h1>Welcome back</h1><p>Sign in to continue to Perennial.</p>
    <form className="form-grid" onSubmit={submit}>
      <div className="form-field"><label htmlFor="email">Email Address</label><input id="email" name="email" type="email" autoComplete="username" required maxLength={320} placeholder="Enter your email" /></div>
      <div className="form-field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={200} placeholder="Enter your password" /></div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="login-actions"><button className="forgot-link" type="button" onClick={() => navigate("/forgot-password")}>Forgot password?</button><button className="btn-primary" type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button></div>
      <p className="login-signup">Don’t have an account? <button className="inline-link" type="button" onClick={() => navigate("/signup")}>Create account</button></p>
    </form>
  </div></AuthShell>;
}
