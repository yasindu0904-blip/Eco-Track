import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../../../errors/applicationError.js";

import type { RewardDependencies } from "../reward.dependencies.js";
import { listMyContributions } from "../services/listMyContributions.service.js";
import { listContributionsQuerySchema } from "../reward.validation.js";

export function listMyContributionsController(dependencies: RewardDependencies) {
  return async function handleListMyContributions(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validation = listContributionsQuerySchema.safeParse(request.query);
      if (!validation.success) {
        throw new ApplicationError(
          400,
          "CONTRIBUTION_QUERY_INVALID",
          validation.error.issues[0]?.message ?? "The contribution-history query is invalid.",
        );
      }
      const page = await listMyContributions(dependencies, {
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
