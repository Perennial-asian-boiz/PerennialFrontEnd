import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  return <AuthShell><div className="auth-card forgot-card"><h1>Forgot password?</h1><p>Enter your email and we’ll send you a verification code.</p><form className="form-grid" noValidate onSubmit={(event) => { event.preventDefault(); if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Email is not valid."); return; } setError(""); navigate("/forgot-password/sent"); }}><div className="form-field"><label htmlFor="forgot-email">Email Address</label><input id="forgot-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="Enter your email" aria-invalid={Boolean(error)} /></div>{error && <p className="auth-error" role="alert">{error}</p>}<button className="btn-primary auth-submit" type="submit">Send code</button><button className="auth-text-link" type="button" onClick={() => navigate("/login")}>← Back to sign in</button></form></div></AuthShell>;
}
