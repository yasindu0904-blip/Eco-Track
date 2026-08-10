import type { OrganizationApplicationDependencies } from "../application.dependencies.js";
import type { OrganizationApplicationDto } from "../application.types.js";
import { listOrganizationApplicationRecordsByRequester } from "../repositories/organizationApplication.repository.js";

export async function listMyOrganizationApplications(
  dependencies: OrganizationApplicationDependencies,
  requesterUserId: string,
): Promise<OrganizationApplicationDto[]> {
  return listOrganizationApplicationRecordsByRequester(
    dependencies.prisma,
    requesterUserId,
  );
}
