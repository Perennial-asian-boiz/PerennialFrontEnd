import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";

export default function AccountCreated() {
  const navigate = useNavigate();
  return <AuthShell><div className="auth-card auth-result-card account-created-card"><div className="success-icon" aria-hidden="true">✓</div><h1>Account created</h1><p>Your Perennial account is ready.</p><button className="auth-text-link" type="button" onClick={() => navigate("/login")}>← Back to sign in</button></div></AuthShell>;
}
