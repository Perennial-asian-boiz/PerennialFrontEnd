import { isPasswordValid, passwordRequirementsMessage } from "./passwordRequirements";

// Keep client-side account creation aligned with the configured password policy.
export type SignupValues = {
  full_name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type SignupErrors = Partial<Record<keyof SignupValues, string>>;

export function validateSignup(values: SignupValues): SignupErrors {
  const errors: SignupErrors = {};
  if (!values.full_name.trim()) errors.full_name = "Enter your full name.";
  else if (values.full_name.length > 200) errors.full_name = "Use no more than 200 characters for your name.";
  if (!values.email.trim()) errors.email = "Enter your email address.";
  else if (values.email.trim().length > 320 || !/^[^\s@<>(),;]+@[^\s@<>(),;]+\.[^\s@<>(),;]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address in the format name@domain.com.";
  }
  if (!values.password) errors.password = "Create a password.";
  else if (values.password.length > 200) errors.password = "Use no more than 200 characters for your password.";
  else if (!isPasswordValid(values.password)) errors.password = passwordRequirementsMessage();
  if (!values.confirmPassword) errors.confirmPassword = "Re-enter your password.";
  else if (values.confirmPassword !== values.password) errors.confirmPassword = "Passwords do not match. Re-enter the same password.";
  return errors;
}
