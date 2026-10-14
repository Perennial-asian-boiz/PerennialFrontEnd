import { ONBOARDING_PREFERENCES_KEY, type OnboardingPreferences, type RiskLevel } from "./data";

export const emptyOnboardingPreferences: OnboardingPreferences = { sectors: [], risk: "" };

export function readOnboardingPreferences(): OnboardingPreferences {
  try {
    const saved = window.localStorage.getItem(ONBOARDING_PREFERENCES_KEY);
    if (!saved) return emptyOnboardingPreferences;

    const parsed = JSON.parse(saved) as Partial<OnboardingPreferences>;
    const validRisks: (RiskLevel | "")[] = ["", "Conservative", "Moderate", "High"];
    return {
      sectors: Array.isArray(parsed.sectors) ? parsed.sectors.filter((sector): sector is string => typeof sector === "string") : [],
      risk: validRisks.includes(parsed.risk ?? "") ? parsed.risk ?? "" : "",
    };
  } catch {
    return emptyOnboardingPreferences;
  }
}

export function saveOnboardingPreferences(preferences: OnboardingPreferences) {
  window.localStorage.setItem(ONBOARDING_PREFERENCES_KEY, JSON.stringify(preferences));
}
