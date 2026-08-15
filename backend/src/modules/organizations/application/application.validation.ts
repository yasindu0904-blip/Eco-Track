import { z } from "zod";

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
    administrativeAreaIds: z
      .array(z.uuid())
      .min(1, "Select at least one GN Division")
      .max(500, "Select no more than 500 GN Divisions"),
  })
  .strict()
  .superRefine((application, context) => {
    const selectedIds = new Set<string>();

    application.administrativeAreaIds.forEach((areaId, index) => {
      if (selectedIds.has(areaId)) {
        context.addIssue({
          code: "custom",
          message: "GN Division selections must be unique",
          path: ["administrativeAreaIds", index],
        });
      }

      selectedIds.add(areaId);
    });
  });

export type ValidatedCreateOrganizationApplication = z.infer<
  typeof createOrganizationApplicationSchema
>;
