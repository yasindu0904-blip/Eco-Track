import { z } from "zod";

import { REWARD_LIST_LIMITS } from "./reward.constants.js";

export const listContributionsQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(REWARD_LIST_LIMITS.maxLimit)
    .default(REWARD_LIST_LIMITS.defaultLimit),
}).strict();

export const contributionCursorPayloadSchema = z.object({
  createdAt: z.string().trim().min(1).max(50),
  id: z.uuid(),
});

export const specialContributionSourceKeySchema = z.string()
  .trim()
  .min(1)
  .max(200)
  .regex(
    /^[a-z0-9][a-z0-9:_-]*$/i,
    "The special-contribution source key is invalid.",
  );
