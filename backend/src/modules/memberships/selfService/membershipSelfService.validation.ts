import { z } from "zod";

export const searchOrganizationsQuerySchema = z
  .object({
    query: z.string().trim().max(100).default(""),
    cursor: z.string().trim().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const createMembershipRequestSchema = z
  .object({
    organizationId: z.uuid(),
    message: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const listMembershipRequestsQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const membershipRequestIdSchema = z.uuid();

export const organizationSearchCursorSchema = z.object({
  name: z.string().min(1).max(160),
  id: z.uuid(),
});

export const membershipRequestCursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.uuid(),
});
