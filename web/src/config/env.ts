function readRequiredValue(
  name: string,
  value: string | undefined,
): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(
      `Missing required web environment variable: ${name}`,
    );
  }

  return normalizedValue;
}

function readRequiredUrl(
  name: string,
  value: string | undefined,
): string {
  const normalizedValue =
    readRequiredValue(name, value);

  try {
    new URL(normalizedValue);
  } catch {
    throw new Error(
      `${name} must be a valid URL.`,
    );
  }

  return normalizedValue;
}

export const webEnv = {
  supabaseUrl: readRequiredUrl(
    "VITE_SUPABASE_URL",
    import.meta.env.VITE_SUPABASE_URL,
  ),

  supabasePublishableKey: readRequiredValue(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    import.meta.env
      .VITE_SUPABASE_PUBLISHABLE_KEY,
  ),

  apiBaseUrl: readRequiredUrl(
    "VITE_API_BASE_URL",
    import.meta.env.VITE_API_BASE_URL,
  ),

  incidentEvidenceBucket:
    import.meta.env.VITE_INCIDENT_EVIDENCE_BUCKET?.trim() ||
    "incident-evidence",
  eventEvidenceBucket:
    import.meta.env.VITE_EVENT_EVIDENCE_BUCKET?.trim() ||
    "event-evidence",
} as const;
