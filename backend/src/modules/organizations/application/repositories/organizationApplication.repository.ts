import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { ServiceAreaStatus } from "../../../../generated/prisma/enums.js";

import type {
  CreateOrganizationApplicationCommand,
  OrganizationApplicationDto,
  OrganizationServiceAreaDto,
} from "../application.types.js";

export type BoundaryValidationResult = {
  isEmpty: boolean;
  isValid: boolean;
  geometryType: string;
  validityReason: string;
};

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

export async function validateServiceAreaBoundary(
  prisma: PrismaClient,
  boundary: unknown,
): Promise<BoundaryValidationResult> {
  const boundaryJson = JSON.stringify(boundary);
  const results = await prisma.$queryRaw<BoundaryValidationResult[]>`
    WITH geometry AS (
      SELECT extensions.ST_SetSRID(
        extensions.ST_GeomFromGeoJSON(${boundaryJson}::json),
        4326
      ) AS value
    )
    SELECT
      extensions.ST_IsEmpty(value) AS "isEmpty",
      extensions.ST_IsValid(value) AS "isValid",
      extensions.GeometryType(value) AS "geometryType",
      extensions.ST_IsValidReason(value) AS "validityReason"
    FROM geometry
  `;

  const result = results[0];

  if (!result) {
    throw new Error("PostGIS did not return a boundary validation result.");
  }

  return result;
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
          areaName: true,
          status: true,
          reviewedAt: true,
          reviewNotes: true,
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
      areaName: serviceArea.areaName,
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
          areaName: true,
          status: true,
          reviewedAt: true,
          reviewNotes: true,
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
      areaName: serviceArea.areaName,
      status: serviceArea.status,
      reviewedAt: serviceArea.reviewedAt?.toISOString() ?? null,
      reviewNotes: serviceArea.reviewNotes,
    })),
  };
}

export type CreateOrganizationApplicationRecordCommand =
  CreateOrganizationApplicationCommand & {
    slug: string;
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

    for (const serviceArea of command.application.serviceAreas) {
      const serviceAreaId = randomUUID();
      const boundaryJson = JSON.stringify(serviceArea.boundary);

      await transaction.$executeRaw`
        INSERT INTO "organization_service_areas" (
          "id",
          "organization_id",
          "area_name",
          "boundary",
          "status",
          "created_at",
          "updated_at"
        )
        VALUES (
          ${serviceAreaId}::uuid,
          ${organization.id}::uuid,
          ${serviceArea.areaName},
          extensions.ST_Multi(
            extensions.ST_SetSRID(
              extensions.ST_GeomFromGeoJSON(${boundaryJson}::json),
              4326
            )
          )::extensions.geography,
          'PENDING_REVIEW'::"ServiceAreaStatus",
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;

      serviceAreas.push({
        id: serviceAreaId,
        areaName: serviceArea.areaName,
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
