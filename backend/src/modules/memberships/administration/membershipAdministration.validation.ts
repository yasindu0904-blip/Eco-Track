import { z } from "zod";

export const administrationIdSchema = z.uuid();

export const listPendingRequestsQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const listMembersQuerySchema = z
  .object({
    query: z.string().trim().max(100).default(""),
    role: z.enum(["ORG_MEMBER", "ORG_ADMIN"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "LEFT", "REMOVED"]).optional(),
    cursor: z.string().trim().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const listActiveMembershipsQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const declineMembershipRequestSchema = z
  .object({
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

export const addExistingMemberSchema = z
  .object({
    email: z.email().trim().toLowerCase().max(254),
  })
  .strict();

export const changeMembershipRoleSchema = z
  .object({
    role: z.enum(["ORG_MEMBER", "ORG_ADMIN"]),
  })
  .strict();

export const changeMembershipStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED", "REMOVED"]),
  })
  .strict();

export const dateIdCursorSchema = z.object({
  date: z.string().datetime({ offset: true }),
  id: z.uuid(),
});

export const organizationNameCursorSchema = z.object({
  name: z.string().min(1).max(160),
  id: z.uuid(),
});
