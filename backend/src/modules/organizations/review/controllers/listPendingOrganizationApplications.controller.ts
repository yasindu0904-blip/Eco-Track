import { applicationListQuerySchema } from "../../application/application.validation.js";
import { ApplicationError } from "../../../../errors/applicationError.js";
import type { NextFunction, Request, Response } from "express";

import type { OrganizationApplicationDependencies } from "../../application/application.dependencies.js";
import { listPendingOrganizationApplications, listPendingOrganizationApplicationPage } from "../services/listPendingOrganizationApplications.service.js";

export function listPendingOrganizationApplicationsController(
  dependencies: OrganizationApplicationDependencies,
) {
  return async function handleListPendingOrganizationApplications(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const query = applicationListQuerySchema.omit({ section: true }).safeParse(request.query);
      if (!query.success) throw new ApplicationError(400, "APPLICATION_QUERY_INVALID", "Invalid application filters.");
      const applications = Object.keys(request.query).length
        ? await listPendingOrganizationApplicationPage(dependencies, query.data)
        : await listPendingOrganizationApplications(dependencies);
      response.status(200).json({ data: applications });
    } catch (error) {
      next(error);
    }
  };
}
