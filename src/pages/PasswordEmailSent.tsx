import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";

export default function PasswordEmailSent() {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => { if (secondsLeft === 0) return; const timer = window.setInterval(() => setSecondsLeft((current) => Math.max(current - 1, 0)), 1000); return () => window.clearInterval(timer); }, [secondsLeft]);
  const resend = () => { if (secondsLeft === 0) setSecondsLeft(30); };
  return <AuthShell><div className="auth-card auth-result-card"><div className="success-icon" aria-hidden="true">✓</div><h1>Check your email</h1><p>We sent a password reset link to your email.</p><p className="auth-muted-line">Didn’t receive the email? <button className="inline-link" type="button" onClick={resend} disabled={secondsLeft > 0}>{secondsLeft > 0 ? `Resend link in ${secondsLeft}s` : "Resend link"}</button></p><button className="auth-text-link" type="button" onClick={() => navigate("/login")}>← Back to sign in</button></div></AuthShell>;
}
