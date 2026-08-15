import { ApplicationError } from "../../../../errors/applicationError.js";
import type { OrganizationApplicationDependencies } from "../../application/application.dependencies.js";
import {
  applyOrganizationReviewTransaction,
  findOrganizationApplicationReviewRecord,
} from "../repositories/organizationReview.repository.js";
import type {
  OrganizationReviewApplicationDto,
  ReviewOrganizationApplicationCommand,
} from "../organizationReview.types.js";

export async function reviewOrganizationApplication(
  dependencies: OrganizationApplicationDependencies,
  command: ReviewOrganizationApplicationCommand,
): Promise<OrganizationReviewApplicationDto> {
  const result = await applyOrganizationReviewTransaction(
    dependencies.prisma,
    command,
  );

  if (result.outcome === "notFound") {
    throw new ApplicationError(
      404,
      "ORGANIZATION_APPLICATION_NOT_FOUND",
      "The organization application was not found.",
    );
  }

  if (result.outcome === "notPending") {
    throw new ApplicationError(
      409,
      "ORGANIZATION_APPLICATION_ALREADY_REVIEWED",
      "This organization application has already been reviewed.",
    );
  }

  const reviewedApplication = await findOrganizationApplicationReviewRecord(
    dependencies.prisma,
    command.applicationId,
  );

  if (!reviewedApplication) {
    throw new Error("The reviewed organization application could not be loaded.");
  }

  return reviewedApplication;
}
