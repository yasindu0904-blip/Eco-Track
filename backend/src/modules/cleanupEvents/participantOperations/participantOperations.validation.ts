import { z } from "zod";

const uuid = z.string().uuid();
export const participantOperationsParametersSchema = z
  .object({
    organizationId: uuid,
    eventId: uuid,
  })
  .strict();

export const participantParametersSchema = participantOperationsParametersSchema
  .extend({
    participantId: uuid,
  })
  .strict();

export const listEventParticipantsQuerySchema = z
  .object({
    status: z.enum(["JOINED", "WITHDRAWN", "REMOVED"]).default("JOINED"),
    cursor: z.string().trim().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const recordAttendanceSchema = z
  .object({
    status: z.enum(["ATTENDED", "ABSENT"]),
  })
  .strict();

export const removeParticipantSchema = z
  .object({
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

export type ValidatedParticipantOperationsParameters = z.infer<
  typeof participantOperationsParametersSchema
>;
export type ValidatedListEventParticipantsQuery = z.infer<
  typeof listEventParticipantsQuerySchema
>;
export type ValidatedRecordAttendance = z.infer<typeof recordAttendanceSchema>;
export type ValidatedRemoveParticipant = z.infer<
  typeof removeParticipantSchema
>;
