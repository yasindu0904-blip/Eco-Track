import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { ServiceAreaStatus } from "../../../../generated/prisma/enums.js";

import type {
  CreateOrganizationApplicationCommand,
  OrganizationApplicationDto,
  OrganizationServiceAreaDto,
  SelectedAdministrativeArea,
} from "../application.types.js";

export async function organizationSlugExists(
  prisma: PrismaClient,
  slug: string,
): Promise<boolean> {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  });

  return organization !== null;
}

export async function findActiveAdministrativeAreasByIds(
  prisma: PrismaClient,
  ids: string[],
): Promise<SelectedAdministrativeArea[]> {
  return prisma.administrativeArea.findMany({
    where: {
      id: { in: ids },
      isActive: true,
      level: "GN_DIVISION",
    },
    select: {
      id: true,
      officialCode: true,
      nameEn: true,
    },
  });
}

export async function listOrganizationApplicationRecordsByRequester(
  prisma: PrismaClient,
  requesterUserId: string,
): Promise<OrganizationApplicationDto[]> {
  const organizations = await prisma.organization.findMany({
    where: { requestedByUserId: requesterUserId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      registrationNumber: true,
      description: true,
      officialEmail: true,
      officialPhone: true,
      officialAddress: true,
      status: true,
      reviewedAt: true,
      reviewNotes: true,
      createdAt: true,
      updatedAt: true,
      serviceAreas: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          administrativeAreaId: true,
          areaName: true,
          status: true,
          reviewedAt: true,
          reviewNotes: true,
          administrativeArea: {
            select: {
              officialCode: true,
              nameEn: true,
            },
          },
        },
      },
    },
  });

  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    registrationNumber: organization.registrationNumber,
    description: organization.description,
    officialEmail: organization.officialEmail,
    officialPhone: organization.officialPhone,
    officialAddress: organization.officialAddress,
    status: organization.status,
    reviewedAt: organization.reviewedAt?.toISOString() ?? null,
    reviewNotes: organization.reviewNotes,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
    serviceAreas: organization.serviceAreas.map((serviceArea) => ({
      id: serviceArea.id,
      administrativeAreaId: serviceArea.administrativeAreaId,
      officialCode: serviceArea.administrativeArea?.officialCode ?? null,
      areaName:
        serviceArea.administrativeArea?.nameEn ??
        serviceArea.areaName ??
        "Legacy service area",
      status: serviceArea.status,
      reviewedAt: serviceArea.reviewedAt?.toISOString() ?? null,
      reviewNotes: serviceArea.reviewNotes,
    })),
  }));
}

export async function findOrganizationApplicationRecordByIdAndRequester(
  prisma: PrismaClient,
  applicationId: string,
  requesterUserId: string,
): Promise<OrganizationApplicationDto | null> {
  const organization = await prisma.organization.findFirst({
    where: {
      id: applicationId,
      requestedByUserId: requesterUserId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      registrationNumber: true,
      description: true,
      officialEmail: true,
      officialPhone: true,
      officialAddress: true,
      status: true,
      reviewedAt: true,
      reviewNotes: true,
      createdAt: true,
      updatedAt: true,
      serviceAreas: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          administrativeAreaId: true,
          areaName: true,
          status: true,
          reviewedAt: true,
          reviewNotes: true,
          administrativeArea: {
            select: {
              officialCode: true,
              nameEn: true,
            },
          },
        },
      },
    },
  });

  if (!organization) {
    return null;
  }

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    registrationNumber: organization.registrationNumber,
    description: organization.description,
    officialEmail: organization.officialEmail,
    officialPhone: organization.officialPhone,
    officialAddress: organization.officialAddress,
    status: organization.status,
    reviewedAt: organization.reviewedAt?.toISOString() ?? null,
    reviewNotes: organization.reviewNotes,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
    serviceAreas: organization.serviceAreas.map((serviceArea) => ({
      id: serviceArea.id,
      administrativeAreaId: serviceArea.administrativeAreaId,
      officialCode: serviceArea.administrativeArea?.officialCode ?? null,
      areaName:
        serviceArea.administrativeArea?.nameEn ??
        serviceArea.areaName ??
        "Legacy service area",
      status: serviceArea.status,
      reviewedAt: serviceArea.reviewedAt?.toISOString() ?? null,
      reviewNotes: serviceArea.reviewNotes,
    })),
  };
}

export type CreateOrganizationApplicationRecordCommand =
  CreateOrganizationApplicationCommand & {
    slug: string;
    selectedAreas: SelectedAdministrativeArea[];
  };

export async function createOrganizationApplicationRecord(
  prisma: PrismaClient,
  command: CreateOrganizationApplicationRecordCommand,
): Promise<OrganizationApplicationDto> {
  return prisma.$transaction(async (transaction) => {
    const organization = await transaction.organization.create({
      data: {
        requestedByUserId: command.requesterUserId,
        name: command.application.name,
        slug: command.slug,
        registrationNumber:
          command.application.registrationNumber ?? null,
        description: command.application.description ?? null,
        officialEmail: command.application.officialEmail,
        officialPhone: command.application.officialPhone,
        officialAddress: command.application.officialAddress,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        registrationNumber: true,
        description: true,
        officialEmail: true,
        officialPhone: true,
        officialAddress: true,
        status: true,
        reviewedAt: true,
        reviewNotes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const serviceAreas: OrganizationServiceAreaDto[] = [];

    const selectedAreasById = new Map(
      command.selectedAreas.map((area) => [area.id, area]),
    );

    for (const administrativeAreaId of command.application.administrativeAreaIds) {
      const administrativeArea = selectedAreasById.get(administrativeAreaId);

      if (!administrativeArea) {
        throw new Error("A validated GN Division was not available during creation.");
      }

      const serviceArea = await transaction.organizationServiceArea.create({
        data: {
          organizationId: organization.id,
          administrativeAreaId: administrativeArea.id,
        },
        select: { id: true },
      });

      serviceAreas.push({
        id: serviceArea.id,
        administrativeAreaId: administrativeArea.id,
        officialCode: administrativeArea.officialCode,
        areaName: administrativeArea.nameEn,
        status: ServiceAreaStatus.PENDING_REVIEW,
        reviewedAt: null,
        reviewNotes: null,
      });
    }

    await transaction.auditLog.create({
      data: {
        actorUserId: command.requesterUserId,
        organizationId: organization.id,
        action: "ORGANIZATION_APPLICATION_SUBMITTED",
        entityType: "Organization",
        entityId: organization.id,
        metadata: {
          serviceAreaCount: serviceAreas.length,
        },
      },
    });

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      registrationNumber: organization.registrationNumber,
      description: organization.description,
      officialEmail: organization.officialEmail,
      officialPhone: organization.officialPhone,
      officialAddress: organization.officialAddress,
      status: organization.status,
      reviewedAt: organization.reviewedAt?.toISOString() ?? null,
      reviewNotes: organization.reviewNotes,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
      serviceAreas,
    };
  });
}
