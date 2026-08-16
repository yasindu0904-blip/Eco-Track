function requirePublicEnvironmentValue(
  name: string,
  value: string | undefined,
): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(
      `Missing ${name}. Copy mobile/.env.example to mobile/.env.local and provide this value.`,
    );
  }

  return normalizedValue;
}

function removeTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

export const mobileEnv = {
  supabaseUrl: removeTrailingSlashes(
    requirePublicEnvironmentValue(
      "EXPO_PUBLIC_SUPABASE_URL",
      process.env.EXPO_PUBLIC_SUPABASE_URL,
    ),
  ),
  supabasePublishableKey: requirePublicEnvironmentValue(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  apiBaseUrl: removeTrailingSlashes(
    requirePublicEnvironmentValue(
      "EXPO_PUBLIC_API_BASE_URL",
      process.env.EXPO_PUBLIC_API_BASE_URL,
    ),
  ),
  incidentEvidenceBucket:
    process.env.EXPO_PUBLIC_INCIDENT_EVIDENCE_BUCKET?.trim() ||
    "incident-evidence",
};
