import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";

export default function AccessGranted() {
  const navigate = useNavigate();
  return <AuthShell><div className="auth-card auth-result-card access-card"><div className="success-icon" aria-hidden="true">✓</div><h1>Access granted</h1><p>Your identity has been verified.</p><p className="access-redirect-copy">Redirecting to your dashboard...</p><button className="btn-primary auth-submit" type="button" onClick={() => navigate("/")}>Continue</button></div></AuthShell>;
}
