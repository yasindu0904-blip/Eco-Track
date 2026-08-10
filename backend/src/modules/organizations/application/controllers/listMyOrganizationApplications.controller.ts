import type {
  NextFunction,
  Request,
  Response,
} from "express";

import type { OrganizationApplicationDependencies } from "../application.dependencies.js";
import { listMyOrganizationApplications } from "../services/listMyOrganizationApplications.service.js";

export function listMyOrganizationApplicationsController(
  dependencies: OrganizationApplicationDependencies,
) {
  return async function handleListMyOrganizationApplications(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
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
