import { useLocation, useNavigate } from "react-router-dom";

export default function Confirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const risk = (location.state as { risk?: string } | null)?.risk || "Non-selected.";

  return <div className="onboarding-page confirmation-page"><main className="confirmation-content"><span className="setup-complete-badge"><span aria-hidden="true">•</span> SETUP COMPLETE</span><h1>Confirmation &amp; Investment Thesis</h1><p className="confirmation-subtitle">Review your personalized research preferences before entering your<br className="desktop-break" /> workspace.</p><section className="confirmation-card"><div className="confirmation-summary"><div className="confirmation-check" aria-hidden="true">✓</div><div><h2>Personalized Allocation Matrix Prepared</h2><p>All investment parameters have been mapped into your active research stream.</p></div></div><div className="confirmation-risk"><span>RISK PROFILE</span><strong>{risk}</strong></div></section><div className="confirmation-actions"><button className="btn-secondary" type="button" onClick={() => navigate("/setup")}>Update Preferences</button><button className="btn-primary" type="button" onClick={() => navigate("/")}>Go to Dashboard</button></div></main></div>;
}
