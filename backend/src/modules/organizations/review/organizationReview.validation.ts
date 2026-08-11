import { z } from "zod";

export const organizationApplicationIdSchema = z.uuid();

export const approveOrganizationApplicationSchema = z
  .object({
    reviewNotes: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict();

export const declineOrganizationApplicationSchema = z
  .object({
    reviewNotes: z.string().trim().min(3).max(2_000),
  })
  .strict();
