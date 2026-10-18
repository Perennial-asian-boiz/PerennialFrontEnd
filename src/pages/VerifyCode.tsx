import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";
import { AuthApiError, getPendingChallenge, getPendingEmail, getResendSeconds, resendOtp, verifyOtp } from "../api/auth";

export default function VerifyCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState(Array<string>(6).fill(""));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(getResendSeconds);
  useEffect(() => {
    const timer = window.setInterval(() => setSecondsLeft(getResendSeconds()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (code.some((digit) => !digit)) { setError("Enter all six digits."); return; }
    setBusy(true);
    setError("");
    try {
      const response = await verifyOtp(getPendingEmail(), code.join(""));
      navigate(response.flow === "recovery" ? "/reset-password" : response.user.onboarding_completed ? "/" : "/access-granted", { replace: true });
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : "Unable to verify. Please try again.");
    } finally { setBusy(false); }
  }

  async function resend() {
    if (busy || secondsLeft > 0) return;
    setBusy(true);
    setError("");
    try {
      await resendOtp(getPendingEmail());
      setCode(Array<string>(6).fill(""));
      setMessage("A new code was sent. Use the most recent email.");
      setSecondsLeft(getResendSeconds());
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : "Unable to resend the code.");
    } finally { setBusy(false); }
  }

  if (!getPendingChallenge() || !getPendingEmail()) return <Navigate to="/login" replace />;
  return <AuthShell><div className="auth-card verify-card">
    <h1>Check your email</h1><p>Enter the 6-digit code sent to {getPendingEmail()}. It expires in 15 minutes.</p>
    <form className="form-grid" onSubmit={submit}>
      <div className="verification-grid" aria-label="Verification code">{code.map((digit, index) => <input key={index} id={`code-${index}`} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} value={digit} aria-label={`Digit ${index + 1}`} aria-invalid={Boolean(error)} onChange={(event) => {
        const value = event.target.value.replace(/\D/g, "").slice(-1);
        setError(""); setCode((current) => current.map((item, i) => i === index ? value : item));
        if (value && index < 5) document.getElementById(`code-${index + 1}`)?.focus();
      }} onKeyDown={(event) => { if (event.key === "Backspace" && !digit && index > 0) document.getElementById(`code-${index - 1}`)?.focus(); }} onPaste={(event) => {
        const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
        if (pasted.length === 6) { event.preventDefault(); setError(""); setCode(pasted.split("")); document.getElementById("code-5")?.focus(); }
      }} />)}</div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {message && <p className="auth-muted-line" role="status">{message}</p>}
      <button className="btn-primary auth-submit" type="submit" disabled={busy}>{busy ? "Please wait..." : "Verify code"}</button>
      <p className="auth-muted-line verification-resend">Didn’t receive a code? <button className="inline-link" type="button" disabled={busy || secondsLeft > 0} onClick={resend}>{secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend"}</button></p>
      <button className="auth-text-link" type="button" onClick={() => navigate("/login")}>← Back to sign in</button>
    </form>
  </div></AuthShell>;
}
