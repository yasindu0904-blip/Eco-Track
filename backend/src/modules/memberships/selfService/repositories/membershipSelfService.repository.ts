import type {
  Prisma,
  PrismaClient,
} from "../../../../generated/prisma/client.js";
import {
  AccountStatus,
  MembershipRequestStatus,
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  PlatformRole,
} from "../../../../generated/prisma/enums.js";

import type {
  MembershipRequestCursor,
  OrganizationSearchCursor,
} from "../membershipSelfService.types.js";

export type MembershipDatabase = PrismaClient | Prisma.TransactionClient;

export const publicOrganizationSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
} as const;

export const membershipRequestSelect = {
  id: true,
  message: true,
  status: true,
  reviewedAt: true,
  reviewNotes: true,
  createdAt: true,
  organization: {
    select: publicOrganizationSelect,
  },
} as const;

export function searchActiveOrganizationRecords(
  prisma: PrismaClient,
  command: {
    query: string;
    cursor: OrganizationSearchCursor | null;
    limit: number;
  },
) {
  return prisma.organization.findMany({
    where: {
      status: OrganizationStatus.ACTIVE,
      archivedAt: null,
      AND: [
        ...(command.query
          ? [
              {
                OR: [
                  { name: { contains: command.query, mode: "insensitive" as const } },
                  { slug: { contains: command.query, mode: "insensitive" as const } },
                  { description: { contains: command.query, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
        ...(command.cursor
          ? [
              {
                OR: [
                  { name: { gt: command.cursor.name } },
                  {
                    name: command.cursor.name,
                    id: { gt: command.cursor.id },
                  },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: command.limit + 1,
    select: publicOrganizationSelect,
  });
}

export function findSelfServiceRequesterRecord(
  prisma: MembershipDatabase,
  userId: string,
) {
  return prisma.userProfile.findUnique({
    where: { id: userId },
    select: {
      platformRole: true,
      accountStatus: true,
    },
  });
}

export function findActiveOrganizationRecord(
  prisma: MembershipDatabase,
  organizationId: string,
) {
  return prisma.organization.findFirst({
    where: {
      id: organizationId,
      status: OrganizationStatus.ACTIVE,
      archivedAt: null,
    },
    select: publicOrganizationSelect,
  });
}

export function findActiveMembershipRecord(
  prisma: MembershipDatabase,
  organizationId: string,
  userId: string,
) {
  return prisma.organizationMembership.findFirst({
    where: {
      organizationId,
      userId,
      status: MembershipStatus.ACTIVE,
    },
    select: { id: true },
  });
}

export function findPendingMembershipRequestRecord(
  prisma: MembershipDatabase,
  organizationId: string,
  requesterUserId: string,
) {
  return prisma.organizationMembershipRequest.findFirst({
    where: {
      organizationId,
      requesterUserId,
      status: MembershipRequestStatus.PENDING,
    },
    select: { id: true },
  });
}

export function createMembershipRequestRecord(
  prisma: MembershipDatabase,
  command: {
    organizationId: string;
    requesterUserId: string;
    message?: string;
  },
) {
  return prisma.organizationMembershipRequest.create({
    data: {
      organizationId: command.organizationId,
      requesterUserId: command.requesterUserId,
      message: command.message ?? null,
    },
    select: membershipRequestSelect,
  });
}

export function listActiveOrganizationAdminUserIds(
  prisma: MembershipDatabase,
  organizationId: string,
) {
  return prisma.organizationMembership.findMany({
    where: {
      organizationId,
      role: MembershipRole.ORG_ADMIN,
      status: MembershipStatus.ACTIVE,
      user: {
        accountStatus: AccountStatus.ACTIVE,
      },
    },
    distinct: ["userId"],
    select: { userId: true },
  });
}

export function listMembershipRequestRecordsByRequester(
  prisma: PrismaClient,
  command: {
    requesterUserId: string;
    cursor: MembershipRequestCursor | null;
    limit: number;
  },
) {
  return prisma.organizationMembershipRequest.findMany({
    where: {
      requesterUserId: command.requesterUserId,
      ...(command.cursor
        ? {
            OR: [
              { createdAt: { lt: command.cursor.createdAt } },
              {
                createdAt: command.cursor.createdAt,
                id: { lt: command.cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: command.limit + 1,
    select: membershipRequestSelect,
  });
}

export function findMembershipRequestRecordByIdAndRequester(
  prisma: MembershipDatabase,
  requestId: string,
  requesterUserId: string,
) {
  return prisma.organizationMembershipRequest.findFirst({
    where: {
      id: requestId,
      requesterUserId,
    },
    select: membershipRequestSelect,
  });
}

export function withdrawPendingMembershipRequestRecord(
  prisma: MembershipDatabase,
  requestId: string,
  requesterUserId: string,
) {
  return prisma.organizationMembershipRequest.updateMany({
    where: {
      id: requestId,
      requesterUserId,
      status: MembershipRequestStatus.PENDING,
    },
    data: {
      status: MembershipRequestStatus.WITHDRAWN,
    },
  });
}

export function isActiveCitizenRequester(record: {
  platformRole: string;
  accountStatus: string;
}): boolean {
  return (
    record.platformRole === PlatformRole.USER &&
    record.accountStatus === AccountStatus.ACTIVE
  );
}
