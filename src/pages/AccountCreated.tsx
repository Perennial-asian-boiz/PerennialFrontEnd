import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";

export default function AccountCreated() {
  const navigate = useNavigate();
  return <AuthShell><div className="auth-card auth-result-card account-created-card"><div className="success-icon" aria-hidden="true">✓</div><h1>Check your email</h1><p>Verify your email to finish creating your Perennial account.</p><button className="btn-primary" type="button" onClick={() => navigate("/verify-code")}>Enter verification code</button></div></AuthShell>;
}
