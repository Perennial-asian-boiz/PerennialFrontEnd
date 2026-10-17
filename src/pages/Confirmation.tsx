import { useLocation, useNavigate } from "react-router-dom";
import { confirmationSectorLabels, riskProfiles, type OnboardingPreferences, type RiskLevel } from "../data";

type ConfirmationState = Partial<OnboardingPreferences>;

export default function Confirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as ConfirmationState | null) ?? {};
  const sectors = routeState.sectors ?? [];
  const risk = (routeState.risk ?? "") as RiskLevel | "";
  const riskProfile = risk ? riskProfiles[risk] : null;
  const dashboardState: OnboardingPreferences = { sectors, risk };

  return <div className="onboarding-page confirmation-page"><main className="confirmation-content"><span className="setup-complete-badge"><span aria-hidden="true">•</span> SETUP COMPLETE</span><h1>Confirmation &amp; Investment Thesis</h1><p className="confirmation-subtitle">Review your personalized research preferences before entering your<br className="desktop-break" /> workspace.</p><section className="confirmation-card"><div className="confirmation-summary"><div className="confirmation-check" aria-hidden="true">✓</div><div><h2>Personalized Allocation Matrix Prepared</h2><p>All investment parameters have been mapped into your active research stream.</p></div></div><div className="confirmation-focus"><span>PRIMARY FOCUS</span><div className="confirmation-sector-list">{sectors.length > 0 ? sectors.map((sector) => <span className="confirmation-sector-chip" key={sector}>{confirmationSectorLabels[sector] ?? sector}</span>) : <strong className="confirmation-empty">Non-selected.</strong>}</div></div><div className="confirmation-risk"><span>RISK PROFILE</span><strong className={riskProfile ? `risk-${riskProfile.color}` : "confirmation-empty"}>{riskProfile ? <><b>{risk}</b> : {riskProfile.description}</> : "Non-selected."}</strong></div></section><div className="confirmation-actions"><button className="btn-secondary" type="button" onClick={() => navigate("/setup")}>Update Preferences</button><button className="btn-primary" type="button" onClick={() => navigate("/", { state: dashboardState })}>Go to Dashboard</button></div></main></div>;
}
