import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";
import { AuthApiError, login } from "../api/auth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(Boolean(location.state?.emailConfirmed));
  const [invalidFields, setInvalidFields] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setEmailConfirmed(false);
    setNotice("");
    if (!email || !password || !(element.elements.namedItem("email") as HTMLInputElement).validity.valid || password.length < 8) {
      element.reset();
      setInvalidFields(true);
      setError("Invalid email or password.");
      return;
    }
    setBusy(true);
    setError("");
    setInvalidFields(false);
    try {
      const response = await login(email, password);
      if (response.flow === "signup") setNotice("Please confirm your email using the link we sent, then sign in.");
      else navigate("/verify-code");
    } catch (caught) {
      if (caught instanceof AuthApiError && caught.status === 401) {
        element.reset();
        setInvalidFields(true);
      }
      setError(caught instanceof AuthApiError ? caught.status === 401 ? "Invalid email or password." : caught.message : "Unable to connect. Please try again.");
    } finally { setBusy(false); }
  }

  return <AuthShell><div className="form-card login-card">
    <h1>Welcome back</h1><p>Sign in to continue to Perennial.</p>
    {emailConfirmed && <p className="auth-confirmation-notice" role="status">Email confirmed. You can sign in now.</p>}
    {notice && <p className="auth-confirmation-notice" role="status">{notice}</p>}
    <form className="form-grid" onSubmit={submit} noValidate onChange={() => { setInvalidFields(false); setEmailConfirmed(false); setError(""); }}>
      <div className="form-field"><label htmlFor="email">Email Address</label><input id="email" name="email" type="email" autoComplete="username" required maxLength={320} placeholder="Enter your email" aria-invalid={invalidFields} aria-describedby={invalidFields ? "login-error" : undefined} /></div>
      <div className="form-field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={200} placeholder="Enter your password" aria-invalid={invalidFields} aria-describedby={invalidFields ? "login-error" : undefined} /></div>
      {error && <p id="login-error" className="auth-error" role="alert">{error}</p>}
      <div className="login-actions"><button className="forgot-link" type="button" onClick={() => navigate("/forgot-password")}>Forgot password?</button><button className="btn-primary" type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button></div>
      <p className="login-signup">Don’t have an account? <button className="inline-link" type="button" onClick={() => navigate("/signup")}>Create account</button></p>
    </form>
  </div></AuthShell>;
}
