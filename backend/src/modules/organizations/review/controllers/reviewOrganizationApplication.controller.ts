import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../../../../errors/applicationError.js";
import type { OrganizationApplicationDependencies } from "../../application/application.dependencies.js";
import type { OrganizationReviewDecision } from "../organizationReview.types.js";
import {
  approveOrganizationApplicationSchema,
  declineOrganizationApplicationSchema,
  organizationApplicationIdSchema,
} from "../organizationReview.validation.js";
import { reviewOrganizationApplication } from "../services/reviewOrganizationApplication.service.js";

export function reviewOrganizationApplicationController(
  dependencies: OrganizationApplicationDependencies,
  decision: OrganizationReviewDecision,
) {
  return async function handleReviewOrganizationApplication(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const idValidation = organizationApplicationIdSchema.safeParse(
        request.params.id,
      );
      const bodyValidation = (
        decision === "APPROVE"
          ? approveOrganizationApplicationSchema
          : declineOrganizationApplicationSchema
      ).safeParse(request.body);

      if (!idValidation.success || !bodyValidation.success) {
        throw new ApplicationError(
          400,
          "INVALID_ORGANIZATION_REVIEW",
          decision === "DECLINE"
            ? "A valid application ID and decline reason are required."
            : "The organization approval request is invalid.",
        );
      }

      const application = await reviewOrganizationApplication(dependencies, {
        applicationId: idValidation.data,
        reviewerUserId: request.authentication.profile.id,
        decision,
        reviewNotes: bodyValidation.data.reviewNotes ?? null,
      });

      response.status(200).json({ data: application });
    } catch (error) {
      next(error);
    }
  };
}
