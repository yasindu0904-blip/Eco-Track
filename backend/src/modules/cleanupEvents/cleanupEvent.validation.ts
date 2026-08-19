import { z } from "zod";

export const uuidSchema = z.string().uuid();

const draftFieldsSchema = z.object({
  incidentId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
  publicInstructions: z.string().optional().nullable(),
  eventLatitude: z.number().refine((n) => n >= -90 && n <= 90),
  eventLongitude: z.number().refine((n) => n >= -180 && n <= 180),
  eventAddress: z.string().optional().nullable(),
  meetingLatitude: z.number().refine((n) => n >= -90 && n <= 90).optional().nullable(),
  meetingLongitude: z.number().refine((n) => n >= -180 && n <= 180).optional().nullable(),
  meetingAddress: z.string().optional().nullable(),
});
const hasCoordinatePairs = (value: { meetingLatitude?: number | null; meetingLongitude?: number | null }) =>
  (value.meetingLatitude == null) === (value.meetingLongitude == null);
export const createDraftSchema = draftFieldsSchema.refine(hasCoordinatePairs, { message: "Meeting latitude and longitude must be supplied together." });

export const updateDraftSchema = draftFieldsSchema.partial().refine((value) => Object.keys(value).length > 0 && hasCoordinatePairs(value), { message: "Provide at least one field and complete coordinate pairs." });

export const draftIdParametersSchema = z.object({ id: uuidSchema });

export const createSessionSchema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/),
  capacity: z.number().int().positive().optional().nullable(),
  locationLatitude: z.number().refine((n) => n >= -90 && n <= 90).optional().nullable(),
  locationLongitude: z.number().refine((n) => n >= -180 && n <= 180).optional().nullable(),
  locationAddress: z.string().optional().nullable(),
}).refine((value) => (value.locationLatitude == null) === (value.locationLongitude == null), { message: "Session latitude and longitude must be supplied together." });

export const sessionIdParametersSchema = z.object({ id: uuidSchema });
export const eventSessionParametersSchema = z.object({ eventId: uuidSchema, sessionId: uuidSchema });

export const assignCoordinatorSchema = z.object({ membershipId: uuidSchema });

export const listQuerySchema = z.object({
  limit: z.number().int().positive().optional(),
  cursor: z.string().optional().nullable(),
});

export type ValidatedCreateDraft = z.infer<typeof createDraftSchema>;
export type ValidatedUpdateDraft = z.infer<typeof updateDraftSchema>;
export type ValidatedCreateSession = z.infer<typeof createSessionSchema>;
