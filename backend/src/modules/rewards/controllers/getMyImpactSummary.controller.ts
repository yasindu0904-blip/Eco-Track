import type { NextFunction, Request, Response } from "express";

import type { RewardDependencies } from "../reward.dependencies.js";
import { getMyImpactSummary } from "../services/getMyImpactSummary.service.js";

export function getMyImpactSummaryController(dependencies: RewardDependencies) {
  return async function handleGetMyImpactSummary(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const summary = await getMyImpactSummary(
        dependencies,
        request.authentication.profile.id,
      );
      response.status(200).json({ data: summary });
    } catch (error) {
      next(error);
    }
  };
}
