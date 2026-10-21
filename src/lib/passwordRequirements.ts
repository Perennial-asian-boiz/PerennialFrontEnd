export type PasswordRequirement = {
  id: "length" | "uppercase" | "lowercase" | "number";
  label: string;
  met: boolean;
};

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { id: "length", label: "8–200 characters", met: password.length >= 8 && password.length <= 200 },
    { id: "uppercase", label: "At least one uppercase letter", met: /[A-Z]/.test(password) },
    { id: "lowercase", label: "At least one lowercase letter", met: /[a-z]/.test(password) },
    { id: "number", label: "At least one number", met: /\d/.test(password) },
  ];
}

export function isPasswordValid(password: string): boolean {
  return getPasswordRequirements(password).every(({ met }) => met);
}

export function passwordRequirementsMessage(): string {
  return "Use 8–200 characters and include an uppercase letter, a lowercase letter, and a number.";
}
