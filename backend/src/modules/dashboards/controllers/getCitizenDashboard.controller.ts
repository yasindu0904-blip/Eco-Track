import type { NextFunction, Request, Response } from "express";

import type { DashboardDependencies } from "../dashboard.types.js";
import { parseDashboardRange } from "../dashboard.validation.js";
import { getCitizenDashboardSummary } from "../services/getCitizenDashboard.service.js";

export function getCitizenDashboardController(
  dependencies: DashboardDependencies,
) {
  return async function handleGetCitizenDashboard(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const summary = await getCitizenDashboardSummary(
        dependencies,
        request.authentication.profile.id,
        parseDashboardRange(request.query),
      );

      response.status(200).json({ data: summary });
    } catch (error) {
      next(error);
    }
  };
}
