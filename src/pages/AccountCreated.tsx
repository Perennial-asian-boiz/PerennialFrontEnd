import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";

export default function AccountCreated() {
  const navigate = useNavigate();
  return <AuthShell className="account-created-shell">
    <section className="auth-card auth-result-card account-created-card" aria-labelledby="account-created-title">
      <div className="success-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg></div>
      <h1 id="account-created-title">Account created</h1>
      <p>Your Perennial account is ready.</p>
      <div className="account-created-actions">
        <button className="auth-text-link" type="button" onClick={() => navigate("/login")}>← Back to sign in</button>
      </div>
    </section>
  </AuthShell>;
}
