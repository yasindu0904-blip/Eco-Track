import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export const notificationIdSchema = z.uuid();

export const notificationCursorPayloadSchema = z.object({
  createdAt: z.string().trim().min(1).max(50),
  id: z.uuid(),
});
