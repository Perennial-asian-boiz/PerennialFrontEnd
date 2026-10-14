import { useState } from "react";
import { useNavigate } from "react-router-dom";
import RiskComfort from "../components/RiskComfort";
import { topics, type RiskLevel } from "../data";
import { readOnboardingPreferences, saveOnboardingPreferences } from "../onboarding";

export default function Setup() {
  const [selected, setSelected] = useState<string[]>(() => readOnboardingPreferences().sectors);
  const [risk, setRisk] = useState<RiskLevel | "">(() => readOnboardingPreferences().risk);
  const navigate = useNavigate();
  const canContinue = selected.length > 0 && Boolean(risk);

  const handleContinue = () => {
    saveOnboardingPreferences({ sectors: selected, risk });
    navigate("/confirmation", { state: { sectors: selected, risk } });
  };

  const handleSkip = () => {
    saveOnboardingPreferences({ sectors: [], risk: "" });
    navigate("/");
  };

  return <div className="onboarding-page setup-page"><main className="setup-panel"><section><h1>What Interests You</h1><p className="setup-section-copy">Select the industries you want to follow:</p><div className="interest-grid">{topics.map((topic) => <button key={topic} type="button" className={`interest-option ${selected.includes(topic) ? "selected" : ""}`} onClick={() => setSelected((current) => current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic])}>{topic}</button>)}</div></section><section className="risk-section"><h2>Risk Comfort</h2><p className="setup-section-copy">Choose your investment style:</p><RiskComfort value={risk} onChange={setRisk} /></section></main><div className="onboarding-actions"><button className="onboarding-skip" type="button" onClick={handleSkip}>Skip for now</button><button className="btn-primary onboarding-continue" type="button" disabled={!canContinue} onClick={handleContinue}>Continue to Confirmation</button></div></div>;
}
