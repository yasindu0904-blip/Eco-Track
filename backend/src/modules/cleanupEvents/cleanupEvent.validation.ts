import { z } from "zod";

import { sriLankaMapLocationSchema } from "../maps/map.validation.js";
import { sriLankaMapViewportQuerySchema } from "../maps/map.validation.js";

export const uuidSchema = z.string().uuid();

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().optional();

const coordinate = z.coerce.number().finite();

const draftFieldsSchema = z
  .object({
    incidentId: uuidSchema.nullable().optional(),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(5_000),
    publicInstructions: optionalText(3_000),
    eventLatitude: coordinate,
    eventLongitude: coordinate,
    eventAddress: optionalText(500),
    meetingLatitude: coordinate.nullable().optional(),
    meetingLongitude: coordinate.nullable().optional(),
    meetingAddress: optionalText(500),
  })
  .strict();

type CoordinatePair = {
  meetingLatitude?: number | null;
  meetingLongitude?: number | null;
};

function addLocationIssues(
  value: {
    eventLatitude?: number;
    eventLongitude?: number;
    meetingLatitude?: number | null;
    meetingLongitude?: number | null;
  },
  context: z.RefinementCtx,
): void {
  const hasEventLatitude = Object.hasOwn(value, "eventLatitude");
  const hasEventLongitude = Object.hasOwn(value, "eventLongitude");
  if (hasEventLatitude !== hasEventLongitude) {
    context.addIssue({
      code: "custom",
      path: ["eventLatitude"],
      message: "Event latitude and longitude must be supplied together.",
    });
  } else if (hasEventLatitude && hasEventLongitude) {
    const eventLocation = sriLankaMapLocationSchema.safeParse({
      latitude: value.eventLatitude,
      longitude: value.eventLongitude,
    });
    if (!eventLocation.success) {
      context.addIssue({
        code: "custom",
        path: ["eventLatitude"],
        message: "The event location must be within the supported Sri Lanka map range.",
      });
    }
  }

  const meeting = value as CoordinatePair;
  const hasMeetingLatitude = Object.hasOwn(value, "meetingLatitude");
  const hasMeetingLongitude = Object.hasOwn(value, "meetingLongitude");
  if (hasMeetingLatitude !== hasMeetingLongitude) {
    context.addIssue({
      code: "custom",
      path: ["meetingLatitude"],
      message: "Meeting latitude and longitude must be supplied together.",
    });
  } else if (meeting.meetingLatitude != null && meeting.meetingLongitude != null) {
    const meetingLocation = sriLankaMapLocationSchema.safeParse({
      latitude: meeting.meetingLatitude,
      longitude: meeting.meetingLongitude,
    });
    if (!meetingLocation.success) {
      context.addIssue({
        code: "custom",
        path: ["meetingLatitude"],
        message: "The meeting location must be within the supported Sri Lanka map range.",
      });
    }
  }
}

export const createDraftSchema = draftFieldsSchema.superRefine(addLocationIssues);

export const updateDraftSchema = draftFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  })
  .superRefine(addLocationIssues);

const organizationParametersSchema = z.object({ organizationId: uuidSchema });

export const draftIdParametersSchema = organizationParametersSchema
  .extend({ id: uuidSchema })
  .strict();

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  );
}

export const createSessionSchema = z
  .object({
    sessionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isRealDate, "Session date must be a real calendar date."),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/),
    capacity: z.coerce.number().int().positive().max(100_000).nullable().optional(),
    locationLatitude: coordinate.nullable().optional(),
    locationLongitude: coordinate.nullable().optional(),
    locationAddress: optionalText(500),
    notes: optionalText(2_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endTime <= value.startTime) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Session end time must be after start time.",
      });
    }
    if ((value.locationLatitude == null) !== (value.locationLongitude == null)) {
      context.addIssue({
        code: "custom",
        path: ["locationLatitude"],
        message: "Session latitude and longitude must be supplied together.",
      });
    } else if (value.locationLatitude != null && value.locationLongitude != null) {
      const location = sriLankaMapLocationSchema.safeParse({
        latitude: value.locationLatitude,
        longitude: value.locationLongitude,
      });
      if (!location.success) {
        context.addIssue({
          code: "custom",
          path: ["locationLatitude"],
          message: "The session location must be within the supported Sri Lanka map range.",
        });
      }
    }
  });

export const eventParametersSchema = organizationParametersSchema
  .extend({ eventId: uuidSchema })
  .strict();

export const publicEventParametersSchema = z
  .object({ eventId: uuidSchema })
  .strict();

export const eventSessionParametersSchema = organizationParametersSchema
  .extend({ eventId: uuidSchema, sessionId: uuidSchema })
  .strict();

export const assignCoordinatorSchema = z
  .object({ membershipId: uuidSchema })
  .strict();

export const listDraftQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const listCleanupEventsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const cleanupEventMapQuerySchema = sriLankaMapViewportQuerySchema;

export type ValidatedCreateDraft = z.infer<typeof createDraftSchema>;
export type ValidatedUpdateDraft = z.infer<typeof updateDraftSchema>;
export type ValidatedCreateSession = z.infer<typeof createSessionSchema>;
export type ValidatedDraftListQuery = z.infer<typeof listDraftQuerySchema>;
export type ValidatedCleanupEventListQuery = z.infer<typeof listCleanupEventsQuerySchema>;
export type ValidatedCleanupEventMapQuery = z.infer<typeof cleanupEventMapQuerySchema>;
