import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";

type SettingsIconName = "notifications" | "profile" | "preferences" | "security" | "logout";

function SettingsIcon({ name }: { name: SettingsIconName }) {
  const paths = {
    notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    profile: <><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="9" r="2.5" /><path d="M8 16c.9-2 7.1-2 8 0" /></>,
    preferences: <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="8" cy="7" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="10" cy="17" r="2" /></>,
    security: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M21 19V5a2 2 0 0 0-2-2h-5" /></>,
  }[name];

  return <span className={`settings-icon settings-icon-${name}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths}</svg></span>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button className={`settings-toggle ${checked ? "checked" : ""}`} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span /></button>;
}

export default function Settings() {
  const navigate = useNavigate();
  const [confidenceAlerts, setConfidenceAlerts] = useState(true);
  const [earningsAlerts, setEarningsAlerts] = useState(true);

  return <AppShell title="Settings" hidePageHeading hideSidebarLogout>
    <div className="settings-high-fidelity">
      <section className="settings-card settings-notifications-card">
        <div className="settings-card-heading"><SettingsIcon name="notifications" /><div><div className="settings-title-line"><h2>Notification Settings</h2><span className="settings-badge">Daily &amp; Weekly Digest</span></div><p>Alert cadences, qualitative research triggers, and price boundary signals</p></div></div>
        <div className="settings-alert-list">
          <div className="settings-alert-row"><div><strong>Confidence Score <em>High Impact</em></strong><span>Real-time alerts when Confidence Score changes.</span></div><Toggle checked={confidenceAlerts} onChange={() => setConfidenceAlerts((current) => !current)} label="Toggle confidence score alerts" /></div>
          <div className="settings-alert-row"><div><strong>Earnings Alerts</strong><span>Trigger instant summaries when normalized EPS or free cash flow deviates ±5%<br className="settings-desktop-break" /> from consensus estimates.</span></div><Toggle checked={earningsAlerts} onChange={() => setEarningsAlerts((current) => !current)} label="Toggle earnings alerts" /></div>
        </div>
      </section>

      <button className="settings-card settings-action-card" type="button" onClick={() => navigate("/profile")}><div className="settings-card-heading"><SettingsIcon name="profile" /><div><h2>Your Profile</h2><p>Primary mandates, institutional affiliation, and terminal seat ID</p></div></div><span className="settings-action-link">Edit Contact</span></button>
      <button className="settings-card settings-action-card" type="button" onClick={() => navigate("/setup#risk-comfort", { state: { returnToSettings: true } })}><div className="settings-card-heading"><SettingsIcon name="preferences" /><div><h2>Update Preference</h2><p>Sectors of interest, risk tolerance recalibration.</p></div></div></button>
      <button className="settings-card settings-action-card" type="button" onClick={() => navigate("/settings/password")}><div className="settings-card-heading"><SettingsIcon name="security" /><div><div className="settings-title-line"><h2>Change your password &amp; Security</h2><span className="settings-badge">2FA: Enabled</span></div><p>Hardware keys, authenticator apps, and rotation cycles</p></div></div><span className="settings-security-button">Update Security</span></button>
      <button className="settings-card settings-logout-card" type="button" onClick={() => navigate("/login")}><SettingsIcon name="logout" /><span>Log out</span></button>
    </div>
  </AppShell>;
}
