import { ApplicationError } from "../../../../errors/applicationError.js";

import type { OrganizationApplicationDependencies } from "../application.dependencies.js";
import type { OrganizationApplicationDto } from "../application.types.js";
import { findOrganizationApplicationRecordByIdAndRequester } from "../repositories/organizationApplication.repository.js";

export async function getMyOrganizationApplication(
  dependencies: OrganizationApplicationDependencies,
  applicationId: string,
  requesterUserId: string,
): Promise<OrganizationApplicationDto> {
  const application = await findOrganizationApplicationRecordByIdAndRequester(
    dependencies.prisma,
    applicationId,
    requesterUserId,
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
