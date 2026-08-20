import type { NextFunction, Request, Response } from "express";

import type { DashboardDependencies } from "../dashboard.types.js";
import { parseDashboardRange } from "../dashboard.validation.js";
import { getOrganizationDashboardSummary } from "../services/getOrganizationDashboard.service.js";

export function getOrganizationDashboardController(
  dependencies: DashboardDependencies,
) {
  return async function handleGetOrganizationDashboard(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const summary = await getOrganizationDashboardSummary(
        dependencies,
        request.tenant!.organization.id,
        parseDashboardRange(request.query),
      );

      response.status(200).json({ data: summary });
    } catch (error) {
      next(error);
    }
  };
}
