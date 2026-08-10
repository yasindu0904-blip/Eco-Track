import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { z } from "zod";

import { ApplicationError } from "../../../../errors/applicationError.js";

import type { OrganizationApplicationDependencies } from "../application.dependencies.js";
import { getMyOrganizationApplication } from "../services/getMyOrganizationApplication.service.js";

const applicationIdSchema = z.uuid();

export function getMyOrganizationApplicationController(
  dependencies: OrganizationApplicationDependencies,
) {
  return async function handleGetMyOrganizationApplication(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const applicationId = applicationIdSchema.safeParse(request.params.id);

      if (!applicationId.success) {
        throw new ApplicationError(
          400,
          "INVALID_ORGANIZATION_APPLICATION_ID",
          "The organization application ID must be a valid UUID.",
        );
      }

      const application = await getMyOrganizationApplication(
        dependencies,
        applicationId.data,
        request.authentication.profile.id,
      );

      response.status(200).json({ data: application });
    } catch (error) {
      next(error);
    }
  };
}
