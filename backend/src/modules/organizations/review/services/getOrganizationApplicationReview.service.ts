import { ApplicationError } from "../../../../errors/applicationError.js";
import type { OrganizationApplicationDependencies } from "../../application/application.dependencies.js";
import { findOrganizationApplicationReviewRecord } from "../repositories/organizationReview.repository.js";
import type { OrganizationReviewApplicationDto } from "../organizationReview.types.js";

export async function getOrganizationApplicationReview(
  dependencies: OrganizationApplicationDependencies,
  applicationId: string,
): Promise<OrganizationReviewApplicationDto> {
  const application = await findOrganizationApplicationReviewRecord(
    dependencies.prisma,
    applicationId,
  );

  if (!application) {
    throw new ApplicationError(
      404,
      "ORGANIZATION_APPLICATION_NOT_FOUND",
      "The organization application was not found.",
    );
  }

  return application;
}
