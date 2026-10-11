import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";

export default function VerifyCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => { if (secondsLeft === 0) return; const timer = window.setInterval(() => setSecondsLeft((current) => Math.max(current - 1, 0)), 1000); return () => window.clearInterval(timer); }, [secondsLeft]);

  const updateCode = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setError("");
    setCode((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    if (digit && index < 5) document.getElementById(`code-${index + 1}`)?.focus();
  };

  return <AuthShell><div className="auth-card verify-card"><h1>Check your email</h1><p>Enter the 6-digit code sent to your email.</p><form className="form-grid" noValidate onSubmit={(event) => { event.preventDefault(); if (code.some((digit) => !digit)) { setError("Code is not valid."); return; } setError(""); navigate("/access-granted"); }}><div className="verification-grid" aria-label="Verification code">{code.map((digit, index) => <input key={index} id={`code-${index}`} inputMode="numeric" maxLength={1} value={digit} onChange={(event) => updateCode(index, event.target.value)} aria-label={`Digit ${index + 1}`} aria-invalid={Boolean(error)} />)}</div>{error && <p className="auth-error" role="alert">{error}</p>}<button className="btn-primary auth-submit" type="submit">Verify code</button><p className="auth-muted-line verification-resend">Didn’t receive a code? <button className="inline-link" type="button" onClick={() => { if (secondsLeft === 0) setSecondsLeft(30); }} disabled={secondsLeft > 0}>{secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend"}</button></p><button className="auth-text-link" type="button" onClick={() => navigate("/login")}>← Back to sign in</button></form></div></AuthShell>;
}
