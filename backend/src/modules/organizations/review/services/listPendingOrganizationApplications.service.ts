import type { OrganizationApplicationDependencies } from "../../application/application.dependencies.js";
import { listPendingOrganizationApplicationRecords } from "../repositories/organizationReview.repository.js";
import type { OrganizationReviewApplicationDto } from "../organizationReview.types.js";

export function listPendingOrganizationApplications(
  dependencies: OrganizationApplicationDependencies,
): Promise<OrganizationReviewApplicationDto[]> {
  return listPendingOrganizationApplicationRecords(dependencies.prisma);
}
