import type { NextFunction, Request, Response } from "express";

import type { OrganizationApplicationDependencies } from "../../application/application.dependencies.js";
import { listPendingOrganizationApplications } from "../services/listPendingOrganizationApplications.service.js";

export function listPendingOrganizationApplicationsController(
  dependencies: OrganizationApplicationDependencies,
) {
  return async function handleListPendingOrganizationApplications(
    _request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const applications = await listPendingOrganizationApplications(dependencies);
      response.status(200).json({ data: applications });
    } catch (error) {
      next(error);
    }
  };
}
