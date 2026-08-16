import { ApplicationError } from "../../../../errors/applicationError.js";
import { NotificationType } from "../../../../generated/prisma/enums.js";
import { createNotificationRecord } from "../../../notifications/repositories/notification.repository.js";

import type { MembershipSelfServiceDependencies } from "../membershipSelfService.dependencies.js";
import { toMembershipRequestDto } from "../membershipSelfService.mapper.js";
import type { MembershipRequestDto } from "../membershipSelfService.types.js";
import {
  createMembershipRequestRecord,
  findActiveMembershipRecord,
  findActiveOrganizationRecord,
  findPendingMembershipRequestRecord,
  findSelfServiceRequesterRecord,
  isActiveCitizenRequester,
  listActiveOrganizationAdminUserIds,
} from "../repositories/membershipSelfService.repository.js";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function createMembershipRequest(
  dependencies: MembershipSelfServiceDependencies,
  command: {
    requesterUserId: string;
    organizationId: string;
    message?: string;
  },
): Promise<MembershipRequestDto> {
  try {
    return await dependencies.prisma.$transaction(async (transaction) => {
      const requester = await findSelfServiceRequesterRecord(
        transaction,
        command.requesterUserId,
      );

      if (!requester || !isActiveCitizenRequester(requester)) {
        throw new ApplicationError(
          403,
          "MEMBERSHIP_REQUEST_NOT_ALLOWED",
          "Only active citizen accounts may request organization membership.",
        );
      }

      const organization = await findActiveOrganizationRecord(
        transaction,
        command.organizationId,
      );

      if (!organization) {
        throw new ApplicationError(
          404,
          "ACTIVE_ORGANIZATION_NOT_FOUND",
          "The active organization could not be found.",
        );
      }

      if (
        await findActiveMembershipRecord(
          transaction,
          command.organizationId,
          command.requesterUserId,
        )
      ) {
        throw new ApplicationError(
          409,
          "ACTIVE_MEMBERSHIP_EXISTS",
          "You already have an active membership in this organization.",
        );
      }

      if (
        await findPendingMembershipRequestRecord(
          transaction,
          command.organizationId,
          command.requesterUserId,
        )
      ) {
        throw new ApplicationError(
          409,
          "PENDING_MEMBERSHIP_REQUEST_EXISTS",
          "You already have a pending request for this organization.",
        );
      }

      const membershipRequest = await createMembershipRequestRecord(
        transaction,
        command,
      );

      const admins = await listActiveOrganizationAdminUserIds(
        transaction,
        command.organizationId,
      );

      for (const admin of admins) {
        await createNotificationRecord(transaction, {
          userId: admin.userId,
          organizationId: command.organizationId,
          type: NotificationType.MEMBERSHIP_UPDATED,
          title: "New membership request",
          message: `A citizen requested to join ${organization.name}.`,
          data: {
            membershipRequestId: membershipRequest.id,
            organizationId: command.organizationId,
            status: membershipRequest.status,
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          actorUserId: command.requesterUserId,
          organizationId: command.organizationId,
          action: "ORGANIZATION_MEMBERSHIP_REQUEST_SUBMITTED",
          entityType: "OrganizationMembershipRequest",
          entityId: membershipRequest.id,
          metadata: { requestedRole: "ORG_MEMBER" },
        },
      });

      return toMembershipRequestDto(membershipRequest);
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ApplicationError(
        409,
        "PENDING_MEMBERSHIP_REQUEST_EXISTS",
        "You already have a pending request for this organization.",
      );
    }

    throw error;
  }
}
