export const INCIDENT_EVIDENCE_LIMITS = {
  maxFiles: 5,
  maxFileSizeBytes: 8 * 1024 * 1024,
  allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;

export const INCIDENT_LIST_LIMITS = {
  defaultLimit: 20,
  maxLimit: 50,
} as const;

export const INCIDENT_SUBMISSION_RATE_LIMIT = {
  maximum: 5,
  windowMilliseconds: 10 * 60 * 1000,
} as const;
