import { z } from "zod";

import {
  sriLankaMapLocationSchema,
  sriLankaMapRadiusQuerySchema,
  sriLankaMapViewportQuerySchema,
} from "../maps/map.validation.js";

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
    eventLatitude: coordinate.optional(),
    eventLongitude: coordinate.optional(),
    eventAddress: optionalText(500),
    meetingLatitude: coordinate.nullable().optional(),
    meetingLongitude: coordinate.nullable().optional(),
    meetingAddress: optionalText(500),
    startsAt: z.coerce.date(),
    capacity: z.coerce
      .number()
      .int()
      .positive()
      .max(100_000)
      .nullable()
      .optional(),
  })
  .strict();

type CoordinatePair = {
  meetingLatitude?: number | null;
  meetingLongitude?: number | null;
};

function addLocationIssues(
  value: {
    incidentId?: string | null;
    eventLatitude?: number;
    eventLongitude?: number;
    meetingLatitude?: number | null;
    meetingLongitude?: number | null;
  },
  context: z.RefinementCtx,
  requireDirectLocation = false,
): void {
  const hasEventLatitude = Object.hasOwn(value, "eventLatitude");
  const hasEventLongitude = Object.hasOwn(value, "eventLongitude");
  if (
    requireDirectLocation &&
    !value.incidentId &&
    (!hasEventLatitude || !hasEventLongitude)
  ) {
    context.addIssue({
      code: "custom",
      path: ["eventLatitude"],
      message: "A direct cleanup event requires a confirmed map location.",
    });
  }
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
        message:
          "The event location must be within the supported Sri Lanka map range.",
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
  } else if (
    meeting.meetingLatitude != null &&
    meeting.meetingLongitude != null
  ) {
    const meetingLocation = sriLankaMapLocationSchema.safeParse({
      latitude: meeting.meetingLatitude,
      longitude: meeting.meetingLongitude,
    });
    if (!meetingLocation.success) {
      context.addIssue({
        code: "custom",
        path: ["meetingLatitude"],
        message:
          "The meeting location must be within the supported Sri Lanka map range.",
      });
    }
  }
}

export const createDraftSchema = draftFieldsSchema.superRefine(
  (value, context) => addLocationIssues(value, context, true),
);

export const updateDraftSchema = draftFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  })
  .superRefine((value, context) => addLocationIssues(value, context));

const organizationParametersSchema = z.object({ organizationId: uuidSchema });

export const draftIdParametersSchema = organizationParametersSchema
  .extend({ id: uuidSchema })
  .strict();

export const eventParametersSchema = organizationParametersSchema
  .extend({ eventId: uuidSchema })
  .strict();

export const publicEventParametersSchema = z
  .object({ eventId: uuidSchema })
  .strict();

export const emptyParticipationBodySchema = z.object({}).strict();

export const assignCoordinatorSchema = z
  .object({ membershipId: uuidSchema })
  .strict();

export const listDraftQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const eventSectionSchema = z.enum(["upcoming", "ongoing", "past", "cancelled"]).optional();

export const listCleanupEventsQuerySchema = z
  .object({
    section: eventSectionSchema,
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const cleanupEventMapQuerySchema = sriLankaMapViewportQuerySchema.safeExtend({
  includePublic: z.enum(["true", "false"]).transform(value => value === "true").optional(),
});
export const cleanupEventNearbyMapQuerySchema = sriLankaMapRadiusQuerySchema.safeExtend({ section: eventSectionSchema });

export const listMyParticipationsQuerySchema = z
  .object({
    section: z.enum(["upcoming", "ongoing", "past", "cancelled", "withdrawn"]).optional(),
    scope: z.enum(["active", "history", "all"]).default("active"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type ValidatedCreateDraft = z.infer<typeof createDraftSchema>;
export type ValidatedUpdateDraft = z.infer<typeof updateDraftSchema>;
export type ValidatedDraftListQuery = z.infer<typeof listDraftQuerySchema>;
export type ValidatedCleanupEventListQuery = z.infer<
  typeof listCleanupEventsQuerySchema
>;
export type ValidatedCleanupEventMapQuery = z.infer<
  typeof cleanupEventMapQuerySchema
>;
export type ValidatedCleanupEventNearbyMapQuery = z.infer<
  typeof cleanupEventNearbyMapQuerySchema
>;
export type ValidatedMyParticipationsQuery = z.infer<
  typeof listMyParticipationsQuerySchema
>;
