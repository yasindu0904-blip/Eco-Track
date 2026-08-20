import type { NextFunction, Request, Response } from "express";

import type { DashboardDependencies } from "../dashboard.types.js";
import { parseDashboardRange } from "../dashboard.validation.js";
import { getPlatformDashboardSummary } from "../services/getPlatformDashboard.service.js";

export function getPlatformDashboardController(
  dependencies: DashboardDependencies,
) {
  return async function handleGetPlatformDashboard(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const summary = await getPlatformDashboardSummary(
        dependencies,
        parseDashboardRange(request.query),
      );

      response.status(200).json({ data: summary });
    } catch (error) {
      next(error);
    }
  };
}
