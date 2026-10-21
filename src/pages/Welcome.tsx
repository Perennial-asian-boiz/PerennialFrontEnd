import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";

export default function Welcome() {
  const navigate = useNavigate();

  return <AuthShell className="onboarding-intro-shell"><div className="onboarding-intro"><h1>Invest With Understanding</h1><div className="onboarding-intro-card"><p>Perennial helps you explore companies, understand market trends, and make more informed investment decisions. Track the companies you care about, review clear financial signals, and receive insights based on your personal interests and risk comfort.</p><button className="btn-primary" type="button" onClick={() => navigate("/setup")}>Get Started</button></div></div></AuthShell>;
}
