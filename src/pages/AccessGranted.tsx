import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";

export default function AccessGranted() {
  const navigate = useNavigate();
  return <AuthShell><div className="auth-card auth-result-card access-card"><div className="success-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg></div><h1>Access granted</h1><p>Your identity has been verified.</p><p className="access-redirect-copy">Continue to personalize your workspace...</p><button className="btn-primary auth-submit" type="button" onClick={() => navigate("/welcome")}>Continue</button></div></AuthShell>;
}
