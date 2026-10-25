import { getPasswordRequirements } from "../lib/passwordRequirements";
import "./PasswordRequirements.css";

type PasswordRequirementsProps = {
  password: string;
  visible: boolean;
};

export default function PasswordRequirements({ password, visible }: PasswordRequirementsProps) {
  if (!visible) return null;

  return <div className="password-requirements" id="password-requirements" role="status" aria-live="polite">
    <p>Password must include:</p>
    <ul>
      {getPasswordRequirements(password).map(({ id, label, met }) => <li key={id} className={met ? "is-met" : ""}>
        <span className="password-requirement-icon" aria-hidden="true">{met ? "✓" : "○"}</span>
        <span>{label}</span>
      </li>)}
    </ul>
  </div>;
}
