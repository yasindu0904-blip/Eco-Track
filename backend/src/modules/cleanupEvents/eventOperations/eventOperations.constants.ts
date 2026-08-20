export const EVENT_NOTE_LIMITS = {
  maximumLength: 2_000,
  pageSize: 100,
} as const;

export const EVENT_EVIDENCE_LIMITS = {
  maxFiles: 5,
  maxFileSizeBytes: 8 * 1024 * 1024,
  allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;

export const EVENT_CANCELLATION_REASON_LIMITS = {
  minimumLength: 10,
  maximumLength: 2_000,
} as const;

export const SESSION_STATUS_TRANSITIONS = {
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
} as const;
