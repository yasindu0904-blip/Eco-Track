import { ApplicationError } from "../../../../errors/applicationError.js";

import type { MembershipAdministrationDependencies } from "../membershipAdministration.dependencies.js";
import { toAdminMembershipRequestDto } from "../membershipAdministration.mapper.js";
import type { AdminMembershipRequestDto } from "../membershipAdministration.types.js";
import { declineMembershipRequestTransaction } from "../repositories/membershipAdministration.repository.js";

export async function declineMembershipRequest(
  dependencies: MembershipAdministrationDependencies,
  command: {
    organizationId: string;
    requestId: string;
    reviewerMembershipId: string;
    reviewerUserId: string;
    reason: string;
  },
): Promise<AdminMembershipRequestDto> {
  const result = await declineMembershipRequestTransaction(dependencies.prisma, command);
  if (result.outcome === "notFound") {
    throw new ApplicationError(404, "MEMBERSHIP_REQUEST_NOT_FOUND", "The membership request was not found.");
  }
  if (result.outcome === "notPending") {
    throw new ApplicationError(409, "MEMBERSHIP_REQUEST_ALREADY_REVIEWED", "This membership request has already been reviewed.");
  }
  if (result.outcome !== "reviewed" || !result.request) {
    throw new Error("The declined membership request could not be loaded.");
  }
  return toAdminMembershipRequestDto(result.request);
}
