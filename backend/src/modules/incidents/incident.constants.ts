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

export const INCIDENT_FALSE_REVIEW_REASON_CODES = [
  "INSUFFICIENT_EVIDENCE",
  "LOCATION_INCORRECT",
  "DUPLICATE_REPORT",
  "NOT_AN_ENVIRONMENTAL_INCIDENT",
  "OUTSIDE_SERVICE_SCOPE",
  "OTHER",
] as const;

export const INCIDENT_REVIEW_LIMITS = {
  privateNotesMaximumLength: 2_000,
  otherReasonMinimumNotesLength: 10,
} as const;
