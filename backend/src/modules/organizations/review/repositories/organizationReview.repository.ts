import type { PrismaClient } from "../../../../generated/prisma/client.js";
import {
  MembershipRole,
  MembershipSource,
  MembershipStatus,
  NotificationType,
  OrganizationStatus,
  ServiceAreaStatus,
} from "../../../../generated/prisma/enums.js";

import type {
  OrganizationReviewApplicationDto,
  ReviewOrganizationApplicationCommand,
  ReviewTransactionResult,
} from "../organizationReview.types.js";

const reviewApplicationSelect = {
  id: true,
  name: true,
  registrationNumber: true,
  description: true,
  officialEmail: true,
  officialPhone: true,
  officialAddress: true,
  status: true,
  reviewNotes: true,
  createdAt: true,
  reviewedAt: true,
  requestedBy: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  serviceAreas: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      administrativeAreaId: true,
      areaName: true,
      status: true,
      administrativeArea: {
        select: {
          nameEn: true,
          officialCode: true,
          divisionalSecretariatName: true,
          districtName: true,
        },
      },
    },
  },
} as const;

type ReviewApplicationRecord = {
  id: string;
  name: string;
  registrationNumber: string | null;
  description: string | null;
  officialEmail: string;
  officialPhone: string;
  officialAddress: string;
  status: OrganizationStatus;
  reviewNotes: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  requestedBy: {
    id: string;
    email: string;
    fullName: string | null;
  };
  serviceAreas: Array<{
    id: string;
    administrativeAreaId: string | null;
    areaName: string | null;
    status: ServiceAreaStatus;
    administrativeArea: {
      nameEn: string;
      officialCode: string;
      divisionalSecretariatName: string | null;
      districtName: string | null;
    } | null;
  }>;
};

function toDto(record: ReviewApplicationRecord): OrganizationReviewApplicationDto {
  return {
    id: record.id,
    name: record.name,
    registrationNumber: record.registrationNumber,
    description: record.description,
    officialEmail: record.officialEmail,
    officialPhone: record.officialPhone,
    officialAddress: record.officialAddress,
    status: record.status,
    reviewNotes: record.reviewNotes,
    createdAt: record.createdAt.toISOString(),
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    requester: record.requestedBy,
    serviceAreas: record.serviceAreas.map((area) => ({
      id: area.id,
      administrativeAreaId: area.administrativeAreaId,
      name: area.administrativeArea?.nameEn ?? area.areaName ?? "Legacy service area",
      officialCode: area.administrativeArea?.officialCode ?? null,
      divisionalSecretariatName:
        area.administrativeArea?.divisionalSecretariatName ?? null,
      districtName: area.administrativeArea?.districtName ?? null,
      status: area.status,
    })),
  };
}

export async function listPendingOrganizationApplicationRecords(
  prisma: PrismaClient,
): Promise<OrganizationReviewApplicationDto[]> {
  const records = await prisma.organization.findMany({
    where: { status: OrganizationStatus.PENDING_REVIEW },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: reviewApplicationSelect,
  });

  return records.map((record) => toDto(record));
}

export async function findOrganizationApplicationReviewRecord(
  prisma: PrismaClient,
  applicationId: string,
): Promise<OrganizationReviewApplicationDto | null> {
  const record = await prisma.organization.findUnique({
    where: { id: applicationId },
    select: reviewApplicationSelect,
  });

  return record ? toDto(record) : null;
}

export async function applyOrganizationReviewTransaction(
  prisma: PrismaClient,
  command: ReviewOrganizationApplicationCommand,
): Promise<ReviewTransactionResult> {
  return prisma.$transaction(async (transaction) => {
    const application = await transaction.organization.findUnique({
      where: { id: command.applicationId },
      select: {
        id: true,
        name: true,
        requestedByUserId: true,
      },
    });

    if (!application) {
      return { outcome: "notFound" };
    }

    const approved = command.decision === "APPROVE";
    const reviewedAt = new Date();
    const organizationStatus = approved
      ? OrganizationStatus.ACTIVE
      : OrganizationStatus.DECLINED;
    const serviceAreaStatus = approved
      ? ServiceAreaStatus.ACTIVE
      : ServiceAreaStatus.REJECTED;

    const update = await transaction.organization.updateMany({
      where: {
        id: application.id,
        status: OrganizationStatus.PENDING_REVIEW,
      },
      data: {
        status: organizationStatus,
        reviewedByUserId: command.reviewerUserId,
        reviewedAt,
        reviewNotes: command.reviewNotes,
        activatedAt: approved ? reviewedAt : null,
      },
    });

    if (update.count !== 1) {
      return { outcome: "notPending" };
    }

    const serviceAreaUpdate = await transaction.organizationServiceArea.updateMany({
      where: {
        organizationId: application.id,
        status: ServiceAreaStatus.PENDING_REVIEW,
      },
      data: {
        status: serviceAreaStatus,
        reviewedByUserId: command.reviewerUserId,
        reviewedAt,
        reviewNotes: command.reviewNotes,
      },
    });

    if (approved) {
      await transaction.organizationMembership.create({
        data: {
          organizationId: application.id,
          userId: application.requestedByUserId,
          role: MembershipRole.ORG_ADMIN,
          status: MembershipStatus.ACTIVE,
          source: MembershipSource.FIRST_ADMIN,
        },
      });
    }

    await transaction.auditLog.create({
      data: {
        actorUserId: command.reviewerUserId,
        organizationId: application.id,
        action: approved
          ? "ORGANIZATION_APPLICATION_APPROVED"
          : "ORGANIZATION_APPLICATION_DECLINED",
        entityType: "Organization",
        entityId: application.id,
        metadata: {
          decision: command.decision,
          serviceAreaCount: serviceAreaUpdate.count,
          reviewNotes: command.reviewNotes,
        },
      },
    });

    await transaction.notification.create({
      data: {
        userId: application.requestedByUserId,
        organizationId: application.id,
        type: NotificationType.ORGANIZATION_REVIEW_UPDATED,
        title: approved
          ? "Organization application approved"
          : "Organization application declined",
        message: approved
          ? `${application.name} is active. You are now its Organization Admin.`
          : `${application.name} was declined. Review the administrator notes for details.`,
        data: {
          organizationId: application.id,
          status: organizationStatus,
        },
      },
    });

    return { outcome: "reviewed" };
  });
}
