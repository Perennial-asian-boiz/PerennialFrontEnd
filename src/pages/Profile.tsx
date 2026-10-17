import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { confirmationSectorLabels } from "../data";
import { getMe, getPreferences, getSessionToken, isAuthApiConfigured } from "../api/auth";

type ProfileIconName = "shield" | "user";

function ProfileIcon({ name }: { name: ProfileIconName }) {
  const paths = name === "shield"
    ? <><path d="M12 3 4.5 6v5.5c0 4.7 3.2 7.7 7.5 9.5 4.3-1.8 7.5-4.8 7.5-9.5V6L12 3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>
    : <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-4.5 13.2-4.5 14 0" /></>;
  return <span className="profile-feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths}</svg></span>;
}

function ProfileToggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button className={`settings-toggle ${checked ? "checked" : ""}`} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span /></button>;
}

export default function Profile() {
  const [moatAlerts, setMoatAlerts] = useState(true);
  const [earningsAlerts, setEarningsAlerts] = useState(true);
  const [sectors, setSectors] = useState<string[]>([]);
  const [name, setName] = useState("Alexander Lane");
  const [email, setEmail] = useState("demo@student.csulb.edu");

  useEffect(() => {
    if (!isAuthApiConfigured() || !getSessionToken()) return;
    getPreferences().then((preferences) => setSectors(preferences.sectors)).catch(() => setSectors([]));
    getMe().then((user) => {
      setName(user.full_name);
      setEmail(user.email);
    }).catch(() => undefined);
  }, []);

  return <AppShell title="Your Profile" hidePageHeading>
    <div className="profile-high-fidelity">
      <section className={`profile-identity-card ${sectors.length === 0 ? "profile-no-sectors" : ""}`}>
        <h1>{name}</h1>
        <p>{email}</p>
        {sectors.length > 0 && <div className="profile-sector-summary"><strong>Sector:</strong>{sectors.map((sector) => <span key={sector}>{confirmationSectorLabels[sector] ?? sector}</span>)}</div>}
      </section>
      <section className="profile-notifications-card">
        <h2>Investment Notification</h2>
        <div className="profile-alert-list">
          <div className="profile-alert-row"><ProfileIcon name="shield" /><div><strong>Moat rating upgrade or downgrade announcements</strong><span>Morningstar &amp; Perennial consensus revisions triggered on<br className="profile-desktop-break" /> quantitative durability thresholds.</span></div><ProfileToggle checked={moatAlerts} onChange={() => setMoatAlerts((current) => !current)} label="Toggle moat rating notifications" /></div>
          <div className="profile-alert-row"><ProfileIcon name="user" /><div><strong>Quarterly Earnings Call transcription synthesis &amp; sentiment shift</strong><span>Real-time LLM-driven extracts comparing executive guidance tone against prior 8-quarter average.</span></div><ProfileToggle checked={earningsAlerts} onChange={() => setEarningsAlerts((current) => !current)} label="Toggle quarterly earnings notifications" /></div>
        </div>
      </section>
    </div>
  </AppShell>;
}
