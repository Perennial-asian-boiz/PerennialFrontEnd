import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import RiskComfort from "../components/RiskComfort";
import { topics, type RiskLevel } from "../data";
import { getCachedPreferences, getPreferences, getSessionToken, isAuthApiConfigured, savePreferences } from "../api/auth";

export default function Setup() {
  const [selected, setSelected] = useState<string[]>(() => getCachedPreferences()?.sectors ?? []);
  const [risk, setRisk] = useState<RiskLevel | "">(() => getCachedPreferences()?.risk_level ?? "");
  const [preferencesLoading, setPreferencesLoading] = useState(() => isAuthApiConfigured() && Boolean(getSessionToken()) && !getCachedPreferences());
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = Boolean(location.state?.returnToSettings);
  const canContinue = !preferencesLoading && selected.length > 0 && Boolean(risk);

  useEffect(() => {
    if (!isAuthApiConfigured() || !getSessionToken()) return;
    getPreferences().then((preferences) => {
      setSelected(preferences.sectors);
      setRisk(preferences.risk_level ?? "");
    }).catch(() => setApiError("Unable to load your saved preferences.")).finally(() => setPreferencesLoading(false));
  }, []);

  useEffect(() => {
    if (location.hash === "#risk-comfort") {
      document.getElementById("risk-comfort")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  const handleContinue = async () => {
    setApiError("");
    setIsSaving(true);
    try {
      if (isAuthApiConfigured() && getSessionToken()) {
        await savePreferences({ sectors: selected, risk_level: risk || null });
      }
      navigate("/confirmation", { state: { sectors: selected, risk } });
    } catch {
      setApiError("Unable to save your preferences. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = async () => {
    if (isEditing) { navigate("/settings"); return; }
    setApiError("");
    setIsSaving(true);
    try {
      if (isAuthApiConfigured() && getSessionToken()) {
        await savePreferences({ sectors: [], risk_level: null });
      }
      navigate("/");
    } catch {
      setApiError("Unable to clear your preferences. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return <div className="onboarding-page setup-page"><main className="setup-panel" aria-busy={preferencesLoading}><section><h1>What Interests You</h1><p className="setup-section-copy">Select the industries you want to follow:</p><div className="interest-grid">{preferencesLoading ? topics.map((topic) => <span className="interest-option-skeleton loading-bar" key={topic} />) : topics.map((topic) => <button key={topic} type="button" className={`interest-option ${selected.includes(topic) ? "selected" : ""}`} onClick={() => setSelected((current) => current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic])}>{topic}</button>)}</div></section><section className="risk-section" id="risk-comfort"><h2>Risk Comfort</h2><p className="setup-section-copy">Choose your investment style:</p>{preferencesLoading ? <div className="risk-loading-skeleton" aria-hidden="true"><span className="loading-bar" /><div>{[0, 1, 2].map((item) => <span className="loading-bar" key={item} />)}</div></div> : <RiskComfort value={risk} onChange={setRisk} />}</section></main>{apiError && <p className="auth-error setup-api-error" role="alert">{apiError}</p>}<div className="onboarding-actions"><button className="onboarding-skip" type="button" onClick={handleSkip} disabled={isSaving || preferencesLoading}>{isEditing ? "Cancel" : "Skip for now"}</button><button className="btn-primary onboarding-continue" type="button" disabled={!canContinue || isSaving} onClick={handleContinue}>{isSaving ? "Saving..." : "Continue to Confirmation"}</button></div></div>;
}
