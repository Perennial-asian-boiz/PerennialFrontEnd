import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AppShell";
import { AuthApiError, signup } from "../api/auth";
import { validateSignup, type SignupErrors, type SignupValues } from "../lib/signupValidation";

export default function Signup() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SignupErrors>({});
  const [busy, setBusy] = useState(false);

  function showFields(form: HTMLFormElement, errors: SignupErrors) {
    setFieldErrors(errors);
    const first = Object.keys(errors)[0];
    const input = first && form.elements.namedItem(first);
    if (input instanceof HTMLElement) input.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    const values: SignupValues = {
      full_name: String(form.get("full_name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    };
    setError("");
    const invalid = validateSignup(values);
    showFields(element, invalid);
    if (Object.keys(invalid).length) return;
    setBusy(true);
    try {
      await signup(values.email, values.full_name, values.password);
      navigate("/account-created");
    } catch (caught) {
      if (caught instanceof AuthApiError) {
        const fields: SignupErrors = {};
        for (const name of ["full_name", "email", "password"] as const) {
          if (caught.fieldErrors[name]) fields[name] = caught.fieldErrors[name];
        }
        // Also support older API deployments that return only detail/status.
        if (caught.status === 409 && !fields.email) fields.email = caught.message;
        showFields(element, fields);
        if (!Object.keys(fields).length) setError(caught.message);
      } else {
        setError("We couldn't connect to the server. Check your connection and try again.");
      }
    } finally { setBusy(false); }
  }

  return <AuthShell className="signup-auth-shell"><div className="form-card signup-card">
    <h1>Create your account</h1><p>Get started with Perennial.</p>
    <form className="form-grid" onSubmit={submit} noValidate onChange={(event) => {
      if (!(event.target instanceof HTMLInputElement)) return;
      const name = event.target.name;
      setFieldErrors((previous) => ({ ...previous, [name]: undefined }));
      setError("");
    }}>
      <div className="form-field">
        <label htmlFor="name">Full Name</label>
        <input id="name" name="full_name" autoComplete="name" required maxLength={200} placeholder="Enter your full name" aria-invalid={Boolean(fieldErrors.full_name)} aria-describedby={fieldErrors.full_name ? "name-error" : undefined} />
        {fieldErrors.full_name && <p id="name-error" className="field-error" role="alert">{fieldErrors.full_name}</p>}
      </div>
      <div className="form-field">
        <label htmlFor="signup-email">Email Address</label>
        <input id="signup-email" name="email" type="email" autoComplete="username" required maxLength={320} placeholder="Enter your email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} />
        {fieldErrors.email && <p id="email-error" className="field-error" role="alert">{fieldErrors.email}</p>}
      </div>
      <div className="form-field">
        <label htmlFor="signup-password">Password</label>
        <input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={200} placeholder="Create a password" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={`password-hint${fieldErrors.password ? " password-error" : ""}`} />
        <p id="password-hint" className="field-hint">Use 8–200 characters. Choose a unique password.</p>
        {fieldErrors.password && <p id="password-error" className="field-error" role="alert">{fieldErrors.password}</p>}
      </div>
      <div className="form-field">
        <label htmlFor="confirm-password">Confirm Password</label>
        <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={200} placeholder="Re-enter your password" aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? "confirm-error" : undefined} />
        {fieldErrors.confirmPassword && <p id="confirm-error" className="field-error" role="alert">{fieldErrors.confirmPassword}</p>}
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="signup-actions"><button className="btn-primary" type="submit" disabled={busy}>{busy ? "Creating account..." : "Create account"}</button></div>
      <p className="signup-login">Already have an account? <button className="inline-link" type="button" onClick={() => navigate("/login")}>Sign in</button></p>
    </form>
  </div></AuthShell>;
}
