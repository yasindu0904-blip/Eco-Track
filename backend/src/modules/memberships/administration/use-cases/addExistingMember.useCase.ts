import { ApplicationError } from "../../../../errors/applicationError.js";

import type { MembershipAdministrationDependencies } from "../membershipAdministration.dependencies.js";
import { toOrganizationMemberDto } from "../membershipAdministration.mapper.js";
import type { OrganizationMemberDto } from "../membershipAdministration.types.js";
import {
  addExistingMemberTransaction,
  isPrismaUniqueConflict,
} from "../repositories/membershipAdministration.repository.js";

export async function addExistingMember(
  dependencies: MembershipAdministrationDependencies,
  command: {
    organizationId: string;
    email: string;
    actorMembershipId: string;
    actorUserId: string;
  },
): Promise<OrganizationMemberDto> {
  try {
    const result = await addExistingMemberTransaction(dependencies.prisma, command);
    if (result.outcome === "notFound") {
      throw new ApplicationError(404, "ELIGIBLE_USER_NOT_FOUND", "An eligible EcoTrack user with that email was not found.");
    }
    if (result.outcome === "userIneligible") {
      throw new ApplicationError(409, "USER_NOT_ELIGIBLE_FOR_MEMBERSHIP", "This EcoTrack user is not eligible for organization membership.");
    }
    if (result.outcome === "activeMembershipExists") {
      throw new ApplicationError(409, "ACTIVE_MEMBERSHIP_EXISTS", "This user already has an active membership in the organization.");
    }
    if (result.outcome === "pendingRequestExists") {
      throw new ApplicationError(409, "PENDING_MEMBERSHIP_REQUEST_EXISTS", "Review this user's pending membership request instead of adding them directly.");
    }
    if (result.outcome !== "updated" || !result.member) {
      throw new Error("The added organization membership could not be loaded.");
    }
    return toOrganizationMemberDto(result.member);
  } catch (error) {
    if (isPrismaUniqueConflict(error)) {
      throw new ApplicationError(409, "ACTIVE_MEMBERSHIP_EXISTS", "This user already has a membership in the organization.");
    }
    throw error;
  }
}
