import { z } from "zod";

import {
  EVENT_CANCELLATION_REASON_LIMITS,
  EVENT_EVIDENCE_LIMITS,
  EVENT_NOTE_LIMITS,
} from "./eventOperations.constants.js";

const uuid = z.string().uuid();
const expectedUpdatedAt = z.iso.datetime({ offset: true });
const optionalReason = z
  .string()
  .trim()
  .min(1)
  .max(2_000)
  .nullable()
  .optional();

export const eventOperationParametersSchema = z
  .object({
    organizationId: uuid,
    eventId: uuid,
  })
  .strict();

export const participantUpdateParametersSchema = z
  .object({ eventId: uuid })
  .strict();

export const addEventNoteSchema = z
  .object({
    visibility: z.enum(["PARTICIPANTS", "INTERNAL"]),
    noteText: z.string().trim().min(1).max(EVENT_NOTE_LIMITS.maximumLength),
  })
  .strict();

const evidenceFileSchema = z
  .object({
    originalFileName: z.string().trim().min(1).max(255),
    contentType: z.enum(EVENT_EVIDENCE_LIMITS.allowedContentTypes),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(EVENT_EVIDENCE_LIMITS.maxFileSizeBytes),
  })
  .strict();

export const eventEvidenceUploadIntentSchema = z
  .object({
    files: z
      .array(evidenceFileSchema)
      .min(1)
      .max(EVENT_EVIDENCE_LIMITS.maxFiles),
  })
  .strict();

export const registerEventEvidenceSchema = z
  .object({
    storagePath: z.string().trim().min(1).max(1_000),
    originalFileName: z.string().trim().min(1).max(255),
    contentType: z.enum(EVENT_EVIDENCE_LIMITS.allowedContentTypes),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(EVENT_EVIDENCE_LIMITS.maxFileSizeBytes),
    type: z.enum(["BEFORE", "PROGRESS", "AFTER"]),
    caption: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const cancelEventSchema = z
  .object({
    expectedUpdatedAt,
    reason: z
      .string()
      .trim()
      .min(EVENT_CANCELLATION_REASON_LIMITS.minimumLength)
      .max(EVENT_CANCELLATION_REASON_LIMITS.maximumLength),
  })
  .strict();

export const completeEventSchema = z
  .object({
    expectedUpdatedAt,
    notes: optionalReason,
  })
  .strict();

export type ValidatedAddEventNote = z.infer<typeof addEventNoteSchema>;
export type ValidatedEventEvidenceUploadIntent = z.infer<
  typeof eventEvidenceUploadIntentSchema
>;
export type ValidatedRegisterEventEvidence = z.infer<
  typeof registerEventEvidenceSchema
>;
export type ValidatedCancelEvent = z.infer<typeof cancelEventSchema>;
export type ValidatedCompleteEvent = z.infer<typeof completeEventSchema>;
