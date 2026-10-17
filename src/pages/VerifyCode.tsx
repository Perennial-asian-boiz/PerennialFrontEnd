import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";
import { AuthApiError, clearPendingDevelopmentCode, getPendingDevelopmentCode, getPendingEmail, isAuthApiConfigured, resendOtp, setPendingDevelopmentCode, verifyOtp } from "../api/auth";

export default function VerifyCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState(() => { const code = getPendingDevelopmentCode(); return code ? `Development code: ${code}` : ""; });
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => { if (secondsLeft === 0) return; const timer = window.setInterval(() => setSecondsLeft((current) => Math.max(current - 1, 0)), 1000); return () => window.clearInterval(timer); }, [secondsLeft]);

  const updateCode = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setError("");
    setCode((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    if (digit && index < 5) document.getElementById(`code-${index + 1}`)?.focus();
  };

  return <AuthShell><div className="auth-card verify-card"><h1>Check your email</h1><p>Enter the 6-digit code sent to your email.</p><form className="form-grid" noValidate onSubmit={async (event) => { event.preventDefault(); if (code.some((digit) => !digit)) { setError("Code is not valid."); return; } const email = getPendingEmail(); if (!email) { setError("Email is not valid."); return; } if (!isAuthApiConfigured()) { setError("Backend connection is not configured."); return; } setError(""); try { await verifyOtp(email, code.join("")); clearPendingDevelopmentCode(); navigate("/access-granted"); } catch (error: unknown) { setError(error instanceof AuthApiError ? error.message : "Code is not valid."); } }}><div className="verification-grid" aria-label="Verification code">{code.map((digit, index) => <input key={index} id={`code-${index}`} inputMode="numeric" maxLength={1} value={digit} onChange={(event) => updateCode(index, event.target.value)} aria-label={`Digit ${index + 1}`} aria-invalid={Boolean(error)} />)}</div>{error && <p className="auth-error" role="alert">{error}</p>}{statusMessage && <p className="auth-muted-line" role="status">{statusMessage}</p>}<button className="btn-primary auth-submit" type="submit">Verify code</button><p className="auth-muted-line verification-resend">Didn’t receive a code? <button className="inline-link" type="button" onClick={async () => { if (secondsLeft > 0) return; const email = getPendingEmail(); if (!email || !isAuthApiConfigured()) { setError("Backend connection is not configured."); return; } try { const response = await resendOtp(email); setPendingDevelopmentCode(response.development_code); setStatusMessage(response.development_code ? `Development code: ${response.development_code}` : "A new code was sent."); setSecondsLeft(30); } catch (error: unknown) { setError(error instanceof AuthApiError ? error.message : "Unable to resend the code."); } }} disabled={secondsLeft > 0}>{secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend"}</button></p><button className="auth-text-link" type="button" onClick={() => navigate("/login")}>← Back to sign in</button></form></div></AuthShell>;
}
