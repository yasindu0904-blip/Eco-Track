import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../../../errors/applicationError.js";

import type { RewardDependencies } from "../reward.dependencies.js";
import { listMyCompletedCleanupEvents } from "../services/listMyCompletedCleanupEvents.service.js";
import { listContributionsQuerySchema } from "../reward.validation.js";

export function listMyCompletedCleanupEventsController(
  dependencies: RewardDependencies,
) {
  return async function handleListMyCompletedCleanupEvents(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validation = listContributionsQuerySchema.safeParse(request.query);
      if (!validation.success) {
        throw new ApplicationError(
          400,
          "COMPLETED_EVENT_QUERY_INVALID",
          validation.error.issues[0]?.message ??
            "The historical-review query is invalid.",
        );
      }
      const page = await listMyCompletedCleanupEvents(dependencies, {
        userId: request.authentication.profile.id,
        limit: validation.data.limit,
        encodedCursor: validation.data.cursor,
      });
      response.status(200).json({ data: page });
    } catch (error) {
      next(error);
    }
  };
}
