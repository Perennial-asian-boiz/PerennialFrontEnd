import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppShell, { Toast } from "../components/AppShell";

type PasswordFields = { oldPassword: string; newPassword: string; confirmPassword: string };

export default function PasswordReset() {
  const navigate = useNavigate();
  const [fields, setFields] = useState<PasswordFields>({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const updateField = (field: keyof PasswordFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fields.oldPassword || !fields.newPassword || !fields.confirmPassword || fields.newPassword.length < 8 || fields.newPassword !== fields.confirmPassword) {
      setError("Password is not valid.");
      return;
    }

    setError("");
    setIsComplete(true);
    setShowToast(true);
  };

  return <AppShell title="Settings" hidePageHeading>
    <div className="password-reset-shell">
      {!isComplete ? <section className="password-reset-card"><h1>Reset Password</h1><form className="password-reset-form" noValidate onSubmit={handleSubmit}>
        <div className="form-field"><label htmlFor="old-password">Old Password</label><input id="old-password" type="password" value={fields.oldPassword} onChange={(event) => updateField("oldPassword", event.target.value)} placeholder="Enter your old password" aria-invalid={Boolean(error)} /></div>
        <div className="form-field"><label htmlFor="new-password">New Password</label><input id="new-password" type="password" value={fields.newPassword} onChange={(event) => updateField("newPassword", event.target.value)} placeholder="Enter your new password" aria-invalid={Boolean(error)} /></div>
        <div className="form-field"><label htmlFor="confirm-new-password">Confirm Password</label><input id="confirm-new-password" type="password" value={fields.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} placeholder="Re-enter your password" aria-invalid={Boolean(error)} /></div>
        {error && <p className="password-reset-error" role="alert">{error}</p>}
        <div className="password-reset-actions"><button className="btn-secondary" type="button" onClick={() => navigate("/settings")}>Cancel</button><button className="btn-primary" type="submit">Confirm</button></div>
      </form></section> : <section className="password-success-card"><h1>Password reset successfully</h1><button className="btn-primary" type="button" onClick={() => navigate("/settings")}>Back</button></section>}
    </div>
    {showToast && <Toast type="success" message="Password reset successfully" onDone={() => setShowToast(false)} />}
  </AppShell>;
}
