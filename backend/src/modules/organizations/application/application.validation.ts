import { z } from "zod";

const longitudeSchema = z.number().finite().min(-180).max(180);
const latitudeSchema = z.number().finite().min(-90).max(90);

const positionSchema = z
  .tuple([longitudeSchema, latitudeSchema])
  .rest(z.number().finite());

const linearRingSchema = z
  .array(positionSchema)
  .min(4, "A polygon ring must contain at least four positions")
  .refine(
    (ring) => {
      const first = ring[0];
      const last = ring[ring.length - 1];

      return first?.[0] === last?.[0] && first?.[1] === last?.[1];
    },
    "A polygon ring must be closed",
  );

const polygonCoordinatesSchema = z
  .array(linearRingSchema)
  .min(1, "A polygon must contain an exterior ring");

export const multiPolygonGeometrySchema = z
  .object({
    type: z.literal("MultiPolygon"),
    coordinates: z
      .array(polygonCoordinatesSchema)
      .min(1, "A MultiPolygon must contain at least one polygon"),
  })
  .strict();

export const organizationServiceAreaInputSchema = z
  .object({
    areaName: z.string().trim().min(2).max(160),
    boundary: multiPolygonGeometrySchema,
  })
  .strict();

export const createOrganizationApplicationSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    registrationNumber: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().min(1).max(2_000).optional(),
    officialEmail: z
      .email()
      .trim()
      .max(320)
      .transform((email) => email.toLowerCase()),
    officialPhone: z
      .string()
      .trim()
      .min(7)
      .max(32)
      .regex(/^\+?[0-9 ()-]+$/, "Invalid official phone number"),
    officialAddress: z.string().trim().min(5).max(500),
    serviceAreas: z
      .array(organizationServiceAreaInputSchema)
      .min(1, "Select at least one service area")
      .max(10, "Select no more than 10 service areas"),
  })
  .strict()
  .superRefine((application, context) => {
    const normalizedNames = new Set<string>();

    application.serviceAreas.forEach((serviceArea, index) => {
      const normalizedName = serviceArea.areaName.toLocaleLowerCase("en");

      if (normalizedNames.has(normalizedName)) {
        context.addIssue({
          code: "custom",
          message: "Service-area names must be unique",
          path: ["serviceAreas", index, "areaName"],
        });
      }

      normalizedNames.add(normalizedName);
    });
  });

export type ValidatedCreateOrganizationApplication = z.infer<
  typeof createOrganizationApplicationSchema
>;
