import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import {
  AccountStatus,
  MembershipRequestStatus,
  MembershipRole,
  MembershipSource,
  MembershipStatus,
  NotificationType,
  OrganizationStatus,
  PlatformRole,
} from "../../../../generated/prisma/enums.js";
import { createNotificationRecord } from "../../../notifications/repositories/notification.repository.js";

import type {
  DateIdCursor,
  OrganizationNameCursor,
} from "../membershipAdministration.types.js";

export type MembershipAdministrationDatabase = PrismaClient | Prisma.TransactionClient;

export const adminMembershipRequestSelect = {
  id: true,
  message: true,
  status: true,
  reviewedAt: true,
  reviewNotes: true,
  createdAt: true,
  requester: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
    },
  },
} as const;

export const organizationMemberSelect = {
  id: true,
  role: true,
  status: true,
  source: true,
  joinedAt: true,
  endedAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
    },
  },
} as const;

const activeWorkspaceSelect = {
  id: true,
  role: true,
  organization: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} as const;

export function listActiveMembershipRecords(
  prisma: PrismaClient,
  command: { userId: string; cursor: OrganizationNameCursor | null; limit: number },
) {
  return prisma.organizationMembership.findMany({
    where: {
      userId: command.userId,
      status: MembershipStatus.ACTIVE,
      organization: {
        status: OrganizationStatus.ACTIVE,
        archivedAt: null,
      },
      ...(command.cursor
        ? {
            OR: [
              { organization: { name: { gt: command.cursor.name } } },
              {
                organization: { name: command.cursor.name },
                id: { gt: command.cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ organization: { name: "asc" } }, { id: "asc" }],
    take: command.limit + 1,
    select: activeWorkspaceSelect,
  });
}

export function listPendingMembershipRequestRecords(
  prisma: PrismaClient,
  command: { organizationId: string; cursor: DateIdCursor | null; limit: number },
) {
  return prisma.organizationMembershipRequest.findMany({
    where: {
      organizationId: command.organizationId,
      status: MembershipRequestStatus.PENDING,
      ...(command.cursor
        ? {
            OR: [
              { createdAt: { lt: command.cursor.date } },
              { createdAt: command.cursor.date, id: { lt: command.cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: command.limit + 1,
    select: adminMembershipRequestSelect,
  });
}

export function listOrganizationMemberRecords(
  prisma: PrismaClient,
  command: {
    organizationId: string;
    query: string;
    role?: MembershipRole;
    status?: MembershipStatus;
    cursor: DateIdCursor | null;
    limit: number;
  },
) {
  return prisma.organizationMembership.findMany({
    where: {
      organizationId: command.organizationId,
      ...(command.role ? { role: command.role } : {}),
      ...(command.status ? { status: command.status } : {}),
      ...(command.query
        ? {
            user: {
              OR: [
                { fullName: { contains: command.query, mode: "insensitive" } },
                { email: { contains: command.query, mode: "insensitive" } },
              ],
            },
          }
        : {}),
      ...(command.cursor
        ? {
            OR: [
              { joinedAt: { lt: command.cursor.date } },
              { joinedAt: command.cursor.date, id: { lt: command.cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
    take: command.limit + 1,
    select: organizationMemberSelect,
  });
}

type RequestReviewOutcome =
  | { outcome: "reviewed"; request: Awaited<ReturnType<typeof findAdminMembershipRequestRecord>> }
  | { outcome: "notFound" | "notPending" | "requesterIneligible" | "activeMembershipExists" };

export function findAdminMembershipRequestRecord(
  prisma: MembershipAdministrationDatabase,
  organizationId: string,
  requestId: string,
) {
  return prisma.organizationMembershipRequest.findFirst({
    where: { id: requestId, organizationId },
    select: adminMembershipRequestSelect,
  });
}

export async function approveMembershipRequestTransaction(
  prisma: PrismaClient,
  command: {
    organizationId: string;
    requestId: string;
    reviewerMembershipId: string;
    reviewerUserId: string;
  },
): Promise<RequestReviewOutcome> {
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.organizationMembershipRequest.findFirst({
      where: { id: command.requestId, organizationId: command.organizationId },
      select: {
        id: true,
        status: true,
        requesterUserId: true,
        requester: {
          select: {
            platformRole: true,
            accountStatus: true,
            profileCompletedAt: true,
            fullName: true,
            phoneNumber: true,
          },
        },
        organization: { select: { name: true } },
      },
    });

    if (!request) return { outcome: "notFound" };
    if (request.status !== MembershipRequestStatus.PENDING) return { outcome: "notPending" };

    const requesterEligible =
      request.requester.platformRole === PlatformRole.USER &&
      request.requester.accountStatus === AccountStatus.ACTIVE &&
      Boolean(
        request.requester.profileCompletedAt &&
          request.requester.fullName?.trim() &&
          request.requester.phoneNumber?.trim(),
      );
    if (!requesterEligible) return { outcome: "requesterIneligible" };

    const existingMembership = await transaction.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: command.organizationId,
          userId: request.requesterUserId,
        },
      },
      select: { id: true, status: true },
    });
    if (existingMembership?.status === MembershipStatus.ACTIVE) {
      return { outcome: "activeMembershipExists" };
    }

    const reviewedAt = new Date();
    const updated = await transaction.organizationMembershipRequest.updateMany({
      where: {
        id: request.id,
        organizationId: command.organizationId,
        status: MembershipRequestStatus.PENDING,
      },
      data: {
        status: MembershipRequestStatus.APPROVED,
        reviewedByMembershipId: command.reviewerMembershipId,
        reviewedAt,
        reviewNotes: null,
      },
    });
    if (updated.count !== 1) return { outcome: "notPending" };

    const membership = existingMembership
      ? await transaction.organizationMembership.update({
          where: { id: existingMembership.id },
          data: {
            role: MembershipRole.ORG_MEMBER,
            status: MembershipStatus.ACTIVE,
            source: MembershipSource.REQUEST_APPROVED,
            sourceRequestId: request.id,
            addedOrApprovedByMembershipId: command.reviewerMembershipId,
            joinedAt: reviewedAt,
            endedAt: null,
          },
          select: { id: true },
        })
      : await transaction.organizationMembership.create({
          data: {
            organizationId: command.organizationId,
            userId: request.requesterUserId,
            role: MembershipRole.ORG_MEMBER,
            status: MembershipStatus.ACTIVE,
            source: MembershipSource.REQUEST_APPROVED,
            sourceRequestId: request.id,
            addedOrApprovedByMembershipId: command.reviewerMembershipId,
          },
          select: { id: true },
        });

    await transaction.auditLog.create({
      data: {
        actorUserId: command.reviewerUserId,
        organizationId: command.organizationId,
        action: "ORGANIZATION_MEMBERSHIP_REQUEST_APPROVED",
        entityType: "OrganizationMembershipRequest",
        entityId: request.id,
        metadata: { membershipId: membership.id, role: MembershipRole.ORG_MEMBER },
      },
    });

    await createNotificationRecord(transaction, {
      userId: request.requesterUserId,
      organizationId: command.organizationId,
      type: NotificationType.MEMBERSHIP_UPDATED,
      title: "Membership request approved",
      message: `Your request to join ${request.organization.name} was approved.`,
      data: {
        membershipRequestId: request.id,
        organizationId: command.organizationId,
        status: MembershipRequestStatus.APPROVED,
      },
    });

    return {
      outcome: "reviewed",
      request: await findAdminMembershipRequestRecord(transaction, command.organizationId, request.id),
    };
  }, { timeout: 15_000 });
}

export async function declineMembershipRequestTransaction(
  prisma: PrismaClient,
  command: {
    organizationId: string;
    requestId: string;
    reviewerMembershipId: string;
    reviewerUserId: string;
    reason: string;
  },
): Promise<RequestReviewOutcome> {
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.organizationMembershipRequest.findFirst({
      where: { id: command.requestId, organizationId: command.organizationId },
      select: {
        id: true,
        status: true,
        requesterUserId: true,
        organization: { select: { name: true } },
      },
    });
    if (!request) return { outcome: "notFound" };
    if (request.status !== MembershipRequestStatus.PENDING) return { outcome: "notPending" };

    const reviewedAt = new Date();
    const updated = await transaction.organizationMembershipRequest.updateMany({
      where: {
        id: request.id,
        organizationId: command.organizationId,
        status: MembershipRequestStatus.PENDING,
      },
      data: {
        status: MembershipRequestStatus.DECLINED,
        reviewedByMembershipId: command.reviewerMembershipId,
        reviewedAt,
        reviewNotes: command.reason,
      },
    });
    if (updated.count !== 1) return { outcome: "notPending" };

    await transaction.auditLog.create({
      data: {
        actorUserId: command.reviewerUserId,
        organizationId: command.organizationId,
        action: "ORGANIZATION_MEMBERSHIP_REQUEST_DECLINED",
        entityType: "OrganizationMembershipRequest",
        entityId: request.id,
        metadata: { reviewNotes: command.reason },
      },
    });
    await createNotificationRecord(transaction, {
      userId: request.requesterUserId,
      organizationId: command.organizationId,
      type: NotificationType.MEMBERSHIP_UPDATED,
      title: "Membership request declined",
      message: `Your request to join ${request.organization.name} was declined.`,
      data: {
        membershipRequestId: request.id,
        organizationId: command.organizationId,
        status: MembershipRequestStatus.DECLINED,
      },
    });

    return {
      outcome: "reviewed",
      request: await findAdminMembershipRequestRecord(transaction, command.organizationId, request.id),
    };
  }, { timeout: 15_000 });
}

type MemberMutationOutcome =
  | { outcome: "updated"; member: Awaited<ReturnType<typeof findOrganizationMemberRecord>> }
  | {
      outcome:
        | "notFound"
        | "userIneligible"
        | "activeMembershipExists"
        | "pendingRequestExists"
        | "inactiveMembership"
        | "invalidStatusTransition"
        | "unchanged"
        | "finalActiveAdmin";
    };

export function findOrganizationMemberRecord(
  prisma: MembershipAdministrationDatabase,
  organizationId: string,
  membershipId: string,
) {
  return prisma.organizationMembership.findFirst({
    where: { id: membershipId, organizationId },
    select: organizationMemberSelect,
  });
}

export async function addExistingMemberTransaction(
  prisma: PrismaClient,
  command: {
    organizationId: string;
    email: string;
    actorMembershipId: string;
    actorUserId: string;
  },
): Promise<MemberMutationOutcome> {
  return prisma.$transaction(async (transaction) => {
    const [organization, user] = await Promise.all([
      transaction.organization.findFirst({
        where: { id: command.organizationId, status: OrganizationStatus.ACTIVE, archivedAt: null },
        select: { name: true },
      }),
      transaction.userProfile.findFirst({
        where: { email: { equals: command.email, mode: "insensitive" } },
        select: {
          id: true,
          platformRole: true,
          accountStatus: true,
          profileCompletedAt: true,
          fullName: true,
          phoneNumber: true,
        },
      }),
    ]);
    if (!organization || !user) return { outcome: "notFound" };

    const eligible =
      user.platformRole === PlatformRole.USER &&
      user.accountStatus === AccountStatus.ACTIVE &&
      Boolean(user.profileCompletedAt && user.fullName?.trim() && user.phoneNumber?.trim());
    if (!eligible) return { outcome: "userIneligible" };

    const pendingRequest = await transaction.organizationMembershipRequest.findFirst({
      where: {
        organizationId: command.organizationId,
        requesterUserId: user.id,
        status: MembershipRequestStatus.PENDING,
      },
      select: { id: true },
    });
    if (pendingRequest) return { outcome: "pendingRequestExists" };

    const existing = await transaction.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId: command.organizationId, userId: user.id },
      },
      select: { id: true, status: true },
    });
    if (existing?.status === MembershipStatus.ACTIVE) return { outcome: "activeMembershipExists" };

    const joinedAt = new Date();
    const membership = existing
      ? await transaction.organizationMembership.update({
          where: { id: existing.id },
          data: {
            role: MembershipRole.ORG_MEMBER,
            status: MembershipStatus.ACTIVE,
            addedOrApprovedByMembershipId: command.actorMembershipId,
            joinedAt,
            endedAt: null,
          },
          select: { id: true },
        })
      : await transaction.organizationMembership.create({
          data: {
            organizationId: command.organizationId,
            userId: user.id,
            role: MembershipRole.ORG_MEMBER,
            status: MembershipStatus.ACTIVE,
            source: MembershipSource.ADMIN_ADDED,
            addedOrApprovedByMembershipId: command.actorMembershipId,
          },
          select: { id: true },
        });

    await transaction.auditLog.create({
      data: {
        actorUserId: command.actorUserId,
        organizationId: command.organizationId,
        action: existing ? "ORGANIZATION_MEMBERSHIP_REACTIVATED_BY_ADMIN" : "ORGANIZATION_MEMBER_ADDED",
        entityType: "OrganizationMembership",
        entityId: membership.id,
        metadata: { userId: user.id, role: MembershipRole.ORG_MEMBER },
      },
    });
    await createNotificationRecord(transaction, {
      userId: user.id,
      organizationId: command.organizationId,
      type: NotificationType.MEMBERSHIP_UPDATED,
      title: existing ? "Organization membership reactivated" : "Added to an organization",
      message: existing
        ? `Your membership in ${organization.name} was reactivated.`
        : `You were added to ${organization.name} as an Organization Member.`,
      data: { organizationId: command.organizationId, status: MembershipStatus.ACTIVE },
    });

    return {
      outcome: "updated",
      member: await findOrganizationMemberRecord(transaction, command.organizationId, membership.id),
    };
  }, { timeout: 15_000 });
}

export async function changeMembershipRoleTransaction(
  prisma: PrismaClient,
  command: {
    organizationId: string;
    membershipId: string;
    role: MembershipRole;
    actorUserId: string;
  },
): Promise<MemberMutationOutcome> {
  return prisma.$transaction(async (transaction) => {
    const target = await transaction.organizationMembership.findFirst({
      where: { id: command.membershipId, organizationId: command.organizationId },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        user: { select: { id: true } },
        organization: { select: { name: true } },
      },
    });
    if (!target) return { outcome: "notFound" };
    if (target.status !== MembershipStatus.ACTIVE) return { outcome: "inactiveMembership" };
    if (target.role === command.role) return { outcome: "unchanged" };

    if (target.role === MembershipRole.ORG_ADMIN && command.role === MembershipRole.ORG_MEMBER) {
      const activeAdminCount = await transaction.organizationMembership.count({
        where: {
          organizationId: command.organizationId,
          role: MembershipRole.ORG_ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });
      if (activeAdminCount <= 1) return { outcome: "finalActiveAdmin" };
    }

    const updated = await transaction.organizationMembership.updateMany({
      where: {
        id: target.id,
        organizationId: command.organizationId,
        role: target.role,
        status: MembershipStatus.ACTIVE,
      },
      data: { role: command.role },
    });
    if (updated.count !== 1) return { outcome: "unchanged" };

    await transaction.auditLog.create({
      data: {
        actorUserId: command.actorUserId,
        organizationId: command.organizationId,
        action: "ORGANIZATION_MEMBERSHIP_ROLE_CHANGED",
        entityType: "OrganizationMembership",
        entityId: target.id,
        metadata: { previousRole: target.role, role: command.role, targetUserId: target.userId },
      },
    });
    await createNotificationRecord(transaction, {
      userId: target.userId,
      organizationId: command.organizationId,
      type: NotificationType.MEMBERSHIP_UPDATED,
      title: "Organization role updated",
      message: `Your role in ${target.organization.name} is now ${command.role === MembershipRole.ORG_ADMIN ? "Organization Admin" : "Organization Member"}.`,
      data: { organizationId: command.organizationId, status: command.role },
    });

    return {
      outcome: "updated",
      member: await findOrganizationMemberRecord(transaction, command.organizationId, target.id),
    };
  }, { isolationLevel: "Serializable", timeout: 15_000 });
}

export async function changeMembershipStatusTransaction(
  prisma: PrismaClient,
  command: {
    organizationId: string;
    membershipId: string;
    status: MembershipStatus;
    actorUserId: string;
  },
): Promise<MemberMutationOutcome> {
  return prisma.$transaction(async (transaction) => {
    const target = await transaction.organizationMembership.findFirst({
      where: { id: command.membershipId, organizationId: command.organizationId },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        organization: { select: { name: true } },
      },
    });
    if (!target) return { outcome: "notFound" };
    if (target.status === command.status) return { outcome: "unchanged" };

    const statusTransitionAllowed =
      target.status === MembershipStatus.ACTIVE
        ? command.status === MembershipStatus.SUSPENDED || command.status === MembershipStatus.REMOVED
        : command.status === MembershipStatus.ACTIVE;
    if (!statusTransitionAllowed) return { outcome: "invalidStatusTransition" };

    if (
      target.role === MembershipRole.ORG_ADMIN &&
      target.status === MembershipStatus.ACTIVE &&
      command.status !== MembershipStatus.ACTIVE
    ) {
      const activeAdminCount = await transaction.organizationMembership.count({
        where: {
          organizationId: command.organizationId,
          role: MembershipRole.ORG_ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });
      if (activeAdminCount <= 1) return { outcome: "finalActiveAdmin" };
    }

    const changedAt = new Date();
    const updated = await transaction.organizationMembership.updateMany({
      where: {
        id: target.id,
        organizationId: command.organizationId,
        status: target.status,
      },
      data: {
        status: command.status,
        endedAt:
          command.status === MembershipStatus.REMOVED
            ? changedAt
            : command.status === MembershipStatus.ACTIVE
              ? null
              : undefined,
      },
    });
    if (updated.count !== 1) return { outcome: "unchanged" };

    await transaction.auditLog.create({
      data: {
        actorUserId: command.actorUserId,
        organizationId: command.organizationId,
        action: "ORGANIZATION_MEMBERSHIP_STATUS_CHANGED",
        entityType: "OrganizationMembership",
        entityId: target.id,
        metadata: { previousStatus: target.status, status: command.status, targetUserId: target.userId },
      },
    });
    await createNotificationRecord(transaction, {
      userId: target.userId,
      organizationId: command.organizationId,
      type: NotificationType.MEMBERSHIP_UPDATED,
      title: "Organization membership updated",
      message: `Your membership in ${target.organization.name} is now ${command.status.toLowerCase()}.`,
      data: { organizationId: command.organizationId, status: command.status },
    });

    return {
      outcome: "updated",
      member: await findOrganizationMemberRecord(transaction, command.organizationId, target.id),
    };
  }, { isolationLevel: "Serializable", timeout: 15_000 });
}

export function isPrismaTransactionConflict(error: unknown): boolean {
  const conflictCodes = new Set(["P2034", "40001", "40P01"]);
  const pending: unknown[] = [error];
  const visited = new Set<object>();

  while (pending.length > 0) {
    const candidate = pending.pop();
    if (typeof candidate !== "object" || candidate === null || visited.has(candidate)) continue;
    visited.add(candidate);

    const record = candidate as Record<string, unknown>;
    if (
      [record.code, record.originalCode, record.sqlState].some(
        (value) => typeof value === "string" && conflictCodes.has(value),
      ) ||
      record.kind === "TransactionWriteConflict" ||
      (typeof record.message === "string" &&
        record.message.includes("Transaction failed due to a write conflict or a deadlock"))
    ) {
      return true;
    }

    // Prisma adapter errors can wrap the PostgreSQL SQLSTATE several levels deep.
    pending.push(record.cause, record.meta, record.driverAdapterError);
  }

  return false;
}

export function isPrismaUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
