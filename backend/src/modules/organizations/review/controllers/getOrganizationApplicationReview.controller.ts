import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../../../../errors/applicationError.js";
import type { OrganizationApplicationDependencies } from "../../application/application.dependencies.js";
import { organizationApplicationIdSchema } from "../organizationReview.validation.js";
import { getOrganizationApplicationReview } from "../services/getOrganizationApplicationReview.service.js";

export function getOrganizationApplicationReviewController(
  dependencies: OrganizationApplicationDependencies,
) {
  return async function handleGetOrganizationApplicationReview(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validation = organizationApplicationIdSchema.safeParse(
        request.params.id,
      );

      if (!validation.success) {
        throw new ApplicationError(
          400,
          "INVALID_ORGANIZATION_APPLICATION_ID",
          "The organization application ID is invalid.",
        );
      }

      const application = await getOrganizationApplicationReview(
        dependencies,
        validation.data,
      );

      response.status(200).json({ data: application });
    } catch (error) {
      next(error);
    }
  };
}
