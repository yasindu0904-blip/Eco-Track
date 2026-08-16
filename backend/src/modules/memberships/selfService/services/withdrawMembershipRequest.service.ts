import { ApplicationError } from "../../../../errors/applicationError.js";
import { MembershipRequestStatus } from "../../../../generated/prisma/enums.js";

import type { MembershipSelfServiceDependencies } from "../membershipSelfService.dependencies.js";
import { toMembershipRequestDto } from "../membershipSelfService.mapper.js";
import type { MembershipRequestDto } from "../membershipSelfService.types.js";
import {
  findMembershipRequestRecordByIdAndRequester,
  withdrawPendingMembershipRequestRecord,
} from "../repositories/membershipSelfService.repository.js";

export async function withdrawMembershipRequest(
  dependencies: MembershipSelfServiceDependencies,
  requesterUserId: string,
  requestId: string,
): Promise<MembershipRequestDto> {
  return dependencies.prisma.$transaction(async (transaction) => {
    const existing = await findMembershipRequestRecordByIdAndRequester(
      transaction,
      requestId,
      requesterUserId,
    );

    if (!existing) {
      throw new ApplicationError(
        404,
        "MEMBERSHIP_REQUEST_NOT_FOUND",
        "The membership request could not be found.",
      );
    }

    if (existing.status !== MembershipRequestStatus.PENDING) {
      throw new ApplicationError(
        409,
        "MEMBERSHIP_REQUEST_NOT_PENDING",
        "Only a pending membership request can be withdrawn.",
      );
    }

    const result = await withdrawPendingMembershipRequestRecord(
      transaction,
      requestId,
      requesterUserId,
    );

    if (result.count !== 1) {
      throw new ApplicationError(
        409,
        "MEMBERSHIP_REQUEST_NOT_PENDING",
        "Only a pending membership request can be withdrawn.",
      );
    }

    await transaction.auditLog.create({
      data: {
        actorUserId: requesterUserId,
        organizationId: existing.organization.id,
        action: "ORGANIZATION_MEMBERSHIP_REQUEST_WITHDRAWN",
        entityType: "OrganizationMembershipRequest",
        entityId: requestId,
      },
    });

    const updated = await findMembershipRequestRecordByIdAndRequester(
      transaction,
      requestId,
      requesterUserId,
    );

    if (!updated) {
      throw new ApplicationError(
        500,
        "MEMBERSHIP_REQUEST_UPDATE_FAILED",
        "The membership request could not be reloaded after withdrawal.",
      );
    }

    return toMembershipRequestDto(updated);
  });
}
