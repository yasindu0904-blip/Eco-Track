import { ApplicationError } from "../../../../errors/applicationError.js";

import type { MembershipAdministrationDependencies } from "../membershipAdministration.dependencies.js";
import { toAdminMembershipRequestDto } from "../membershipAdministration.mapper.js";
import type { AdminMembershipRequestDto } from "../membershipAdministration.types.js";
import { approveMembershipRequestTransaction } from "../repositories/membershipAdministration.repository.js";

export async function approveMembershipRequest(
  dependencies: MembershipAdministrationDependencies,
  command: {
    organizationId: string;
    requestId: string;
    reviewerMembershipId: string;
    reviewerUserId: string;
  },
): Promise<AdminMembershipRequestDto> {
  const result = await approveMembershipRequestTransaction(dependencies.prisma, command);
  if (result.outcome === "notFound") {
    throw new ApplicationError(404, "MEMBERSHIP_REQUEST_NOT_FOUND", "The membership request was not found.");
  }
  if (result.outcome === "notPending") {
    throw new ApplicationError(409, "MEMBERSHIP_REQUEST_ALREADY_REVIEWED", "This membership request has already been reviewed.");
  }
  if (result.outcome === "requesterIneligible") {
    throw new ApplicationError(409, "MEMBERSHIP_REQUESTER_INELIGIBLE", "The requester no longer has an eligible active EcoTrack profile.");
  }
  if (result.outcome === "activeMembershipExists") {
    throw new ApplicationError(409, "ACTIVE_MEMBERSHIP_EXISTS", "The requester already has an active membership in this organization.");
  }
  if (result.outcome !== "reviewed" || !result.request) {
    throw new Error("The approved membership request could not be loaded.");
  }
  return toAdminMembershipRequestDto(result.request);
}
