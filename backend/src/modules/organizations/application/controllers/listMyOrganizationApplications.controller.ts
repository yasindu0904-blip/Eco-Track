import { applicationListQuerySchema } from "../application.validation.js";
import { ApplicationError } from "../../../../errors/applicationError.js";
import type {
  NextFunction,
  Request,
  Response,
} from "express";

import type { OrganizationApplicationDependencies } from "../application.dependencies.js";
import { listMyOrganizationApplications, listMyOrganizationApplicationPage } from "../services/listMyOrganizationApplications.service.js";

export function listMyOrganizationApplicationsController(
  dependencies: OrganizationApplicationDependencies,
) {
  return async function handleListMyOrganizationApplications(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (Object.keys(request.query).length) {
        const query = applicationListQuerySchema.safeParse(request.query);
        if (!query.success) throw new ApplicationError(400, "APPLICATION_QUERY_INVALID", "Invalid application filters.");
        response.status(200).json({ data: await listMyOrganizationApplicationPage(dependencies, request.authentication.profile.id, query.data) });
        return;
      }
      const applications = await listMyOrganizationApplications(
        dependencies,
        request.authentication.profile.id,
      );

      response.status(200).json({ data: applications });
    } catch (error) {
      next(error);
    }
  };
}
