import { ApplicationError } from "../../../../errors/applicationError.js";
import type { MembershipStatus } from "../../../../generated/prisma/enums.js";

import type { MembershipAdministrationDependencies } from "../membershipAdministration.dependencies.js";
import { toOrganizationMemberDto } from "../membershipAdministration.mapper.js";
import type { OrganizationMemberDto } from "../membershipAdministration.types.js";
import {
  changeMembershipStatusTransaction,
  isPrismaTransactionConflict,
} from "../repositories/membershipAdministration.repository.js";

export async function changeMembershipStatus(
  dependencies: MembershipAdministrationDependencies,
  command: {
    organizationId: string;
    membershipId: string;
    status: MembershipStatus;
    actorUserId: string;
  },
): Promise<OrganizationMemberDto> {
  try {
    const result = await changeMembershipStatusTransaction(dependencies.prisma, command);
    if (result.outcome === "notFound") throw new ApplicationError(404, "ORGANIZATION_MEMBERSHIP_NOT_FOUND", "The organization membership was not found.");
    if (result.outcome === "invalidStatusTransition") throw new ApplicationError(409, "MEMBERSHIP_STATUS_TRANSITION_INVALID", "This membership status change is not allowed.");
    if (result.outcome === "unchanged") throw new ApplicationError(409, "MEMBERSHIP_STATUS_UNCHANGED", "The membership already has that status or changed concurrently.");
    if (result.outcome === "finalActiveAdmin") throw new ApplicationError(409, "FINAL_ACTIVE_ADMIN_PROTECTED", "Assign another active Organization Admin before changing the final administrator.");
    if (result.outcome !== "updated" || !result.member) {
      throw new Error("The updated organization membership could not be loaded.");
    }
    return toOrganizationMemberDto(result.member);
  } catch (error) {
    if (isPrismaTransactionConflict(error)) {
      throw new ApplicationError(409, "MEMBERSHIP_UPDATE_CONFLICT", "The membership changed concurrently. Refresh and try again.");
    }
    throw error;
  }
}
