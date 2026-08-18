import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";

import type { ValidatedCreateIncident } from "../incident.validation.js";

export const incidentDetailSelect = {
  id: true,
  title: true,
  description: true,
  severity: true,
  status: true,
  latitude: true,
  longitude: true,
  addressText: true,
  highlightUntil: true,
  archiveAfter: true,
  reportedAt: true,
  updatedAt: true,
  resolvedAt: true,
  archivedAt: true,
  category: {
    select: { id: true, name: true, description: true },
  },
  photos: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      storagePath: true,
      caption: true,
      sortOrder: true,
    },
  },
  statusHistory: {
    orderBy: [{ changedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      changedAt: true,
    },
  },
} satisfies Prisma.IncidentSelect;

export type IncidentDetailRecord = Prisma.IncidentGetPayload<{
  select: typeof incidentDetailSelect;
}>;

export async function listActiveIncidentCategories(prisma: PrismaClient) {
  return prisma.incidentCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true },
  });
}

export async function activeIncidentCategoryExists(
  prisma: PrismaClient,
  categoryId: string,
): Promise<boolean> {
  const category = await prisma.incidentCategory.findFirst({
    where: { id: categoryId, isActive: true },
    select: { id: true },
  });
  return category !== null;
}

export async function findIncidentBySubmission(
  prisma: PrismaClient,
  reporterUserId: string,
  submissionId: string,
): Promise<IncidentDetailRecord | null> {
  return prisma.incident.findUnique({
    where: {
      reporterUserId_submissionId: {
        reporterUserId,
        submissionId,
      },
    },
    select: incidentDetailSelect,
  });
}

export async function createIncidentRecord(
  prisma: PrismaClient,
  reporterUserId: string,
  input: ValidatedCreateIncident,
): Promise<IncidentDetailRecord> {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.incident.findUnique({
      where: {
        reporterUserId_submissionId: {
          reporterUserId,
          submissionId: input.submissionId,
        },
      },
      select: incidentDetailSelect,
    });
    if (existing) {
      return existing;
    }

    const settings = await transaction.platformSettings.findUnique({
      where: { id: 1 },
      select: {
        incidentHighlightHours: true,
        incidentUnaddressedDays: true,
      },
    });
    if (!settings) {
      throw new Error("Platform settings row 1 is required before incidents can be created.");
    }

    const reportedAt = new Date();
    const highlightUntil = new Date(
      reportedAt.getTime() + settings.incidentHighlightHours * 60 * 60 * 1000,
    );
    const archiveAfter = new Date(
      highlightUntil.getTime() + settings.incidentUnaddressedDays * 24 * 60 * 60 * 1000,
    );

    return transaction.incident.create({
      data: {
        reporterUserId,
        submissionId: input.submissionId,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        severity: input.severity,
        latitude: input.latitude,
        longitude: input.longitude,
        addressText: input.addressText ?? null,
        reportedAt,
        highlightUntil,
        archiveAfter,
        photos: {
          create: input.evidence.map((photo) => ({
            storagePath: photo.storagePath,
            caption: photo.caption ?? null,
            sortOrder: photo.sortOrder,
          })),
        },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: "ACTIVE",
            changedByUserId: reporterUserId,
            reason: "Incident reported.",
          },
        },
      },
      select: incidentDetailSelect,
    });
  });
}

export interface IncidentListCursor {
  reportedAt: Date;
  id: string;
}

export async function listIncidentRecordsByReporter(
  prisma: PrismaClient,
  input: {
    reporterUserId: string;
    limit: number;
    cursor: IncidentListCursor | null;
  },
): Promise<IncidentDetailRecord[]> {
  return prisma.incident.findMany({
    where: {
      reporterUserId: input.reporterUserId,
      ...(input.cursor
        ? {
            OR: [
              { reportedAt: { lt: input.cursor.reportedAt } },
              {
                reportedAt: input.cursor.reportedAt,
                id: { lt: input.cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ reportedAt: "desc" }, { id: "desc" }],
    take: input.limit + 1,
    select: incidentDetailSelect,
  });
}

export async function findIncidentRecordByIdAndReporter(
  prisma: PrismaClient,
  id: string,
  reporterUserId: string,
): Promise<IncidentDetailRecord | null> {
  return prisma.incident.findFirst({
    where: { id, reporterUserId },
    select: incidentDetailSelect,
  });
}

export async function findPublicSafeIncidentRecordById(
  prisma: PrismaClient,
  id: string,
): Promise<IncidentDetailRecord | null> {
  return prisma.incident.findUnique({
    where: { id },
    select: incidentDetailSelect,
  });
}

export type OrganizationIncidentDiscoveryCursor = {
  reportedAt: Date;
  id: string;
};

export type PublicIncidentDiscoveryRow = {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  categoryDescription: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "ACTIVE" | "CLEANUP_ORGANIZED" | "RESOLVED" | "EXPIRED" | "ARCHIVED";
  latitude: number;
  longitude: number;
  addressText: string | null;
  reportedAt: Date;
  falseReviewCount: number;
};

type PublicIncidentDiscoveryInput = {
  limit: number;
  cursor: OrganizationIncidentDiscoveryCursor | null;
  status?: PublicIncidentDiscoveryRow["status"];
  categoryId?: string;
  reportedAfter?: Date;
};

function incidentDiscoveryFilters(input: PublicIncidentDiscoveryInput) {
  return {
    status: input.status
      ? Prisma.sql`AND incident."status" = ${input.status}::"IncidentStatus"`
      : Prisma.sql`AND incident."status" <> 'ARCHIVED'::"IncidentStatus"`,
    category: input.categoryId
      ? Prisma.sql`AND incident."category_id" = ${input.categoryId}::uuid`
      : Prisma.empty,
    reportedAfter: input.reportedAfter
      ? Prisma.sql`AND incident."reported_at" >= ${input.reportedAfter}`
      : Prisma.empty,
    cursor: input.cursor
      ? Prisma.sql`
          AND (incident."reported_at", incident."id") <
            (${input.cursor.reportedAt}, ${input.cursor.id}::uuid)
        `
      : Prisma.empty,
  };
}

export async function listPublicIncidentsByViewport(
  prisma: PrismaClient,
  input: PublicIncidentDiscoveryInput & {
    west: number;
    south: number;
    east: number;
    north: number;
  },
): Promise<PublicIncidentDiscoveryRow[]> {
  const filters = incidentDiscoveryFilters(input);

  return prisma.$queryRaw<PublicIncidentDiscoveryRow[]>`
    SELECT
      incident."id",
      incident."title",
      category."id" AS "categoryId",
      category."name" AS "categoryName",
      category."description" AS "categoryDescription",
      incident."severity"::text AS "severity",
      incident."status"::text AS "status",
      incident."latitude"::double precision AS "latitude",
      incident."longitude"::double precision AS "longitude",
      incident."address_text" AS "addressText",
      incident."reported_at" AS "reportedAt",
      (
        SELECT COUNT(DISTINCT review."organization_id")::integer
        FROM "incident_reviews" AS review
        JOIN "organizations" AS reviewing_organization
          ON reviewing_organization."id" = review."organization_id"
         AND reviewing_organization."status" = 'ACTIVE'::"OrganizationStatus"
        WHERE review."incident_id" = incident."id"
          AND review."status" = 'FALSE'::"IncidentReviewStatus"
      ) AS "falseReviewCount"
    FROM "incidents" AS incident
    JOIN "incident_categories" AS category
      ON category."id" = incident."category_id"
    WHERE extensions.ST_Intersects(
        incident."geo_point",
        extensions.ST_MakeEnvelope(
          ${input.west}::double precision,
          ${input.south}::double precision,
          ${input.east}::double precision,
          ${input.north}::double precision,
          4326
        )::extensions.geography
      )
      AND extensions.ST_Covers(
        extensions.ST_MakeEnvelope(
          ${input.west}::double precision,
          ${input.south}::double precision,
          ${input.east}::double precision,
          ${input.north}::double precision,
          4326
        )::extensions.geography,
        incident."geo_point"
      )
      ${filters.status}
      ${filters.category}
      ${filters.reportedAfter}
      ${filters.cursor}
    ORDER BY incident."reported_at" DESC, incident."id" DESC
    LIMIT ${input.limit + 1}
  `;
}

export async function listPublicIncidentsByRadius(
  prisma: PrismaClient,
  input: PublicIncidentDiscoveryInput & {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  },
): Promise<PublicIncidentDiscoveryRow[]> {
  const filters = incidentDiscoveryFilters(input);

  return prisma.$queryRaw<PublicIncidentDiscoveryRow[]>`
    SELECT
      incident."id",
      incident."title",
      category."id" AS "categoryId",
      category."name" AS "categoryName",
      category."description" AS "categoryDescription",
      incident."severity"::text AS "severity",
      incident."status"::text AS "status",
      incident."latitude"::double precision AS "latitude",
      incident."longitude"::double precision AS "longitude",
      incident."address_text" AS "addressText",
      incident."reported_at" AS "reportedAt",
      (
        SELECT COUNT(DISTINCT review."organization_id")::integer
        FROM "incident_reviews" AS review
        JOIN "organizations" AS reviewing_organization
          ON reviewing_organization."id" = review."organization_id"
         AND reviewing_organization."status" = 'ACTIVE'::"OrganizationStatus"
        WHERE review."incident_id" = incident."id"
          AND review."status" = 'FALSE'::"IncidentReviewStatus"
      ) AS "falseReviewCount"
    FROM "incidents" AS incident
    JOIN "incident_categories" AS category
      ON category."id" = incident."category_id"
    WHERE extensions.ST_DWithin(
        incident."geo_point",
        extensions.ST_SetSRID(
          extensions.ST_MakePoint(
            ${input.longitude}::double precision,
            ${input.latitude}::double precision
          ),
          4326
        )::extensions.geography,
        ${input.radiusMeters}::double precision
      )
      ${filters.status}
      ${filters.category}
      ${filters.reportedAfter}
      ${filters.cursor}
    ORDER BY incident."reported_at" DESC, incident."id" DESC
    LIMIT ${input.limit + 1}
  `;
}

export type OrganizationIncidentDiscoveryRow = {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  categoryDescription: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "ACTIVE" | "CLEANUP_ORGANIZED" | "RESOLVED" | "EXPIRED" | "ARCHIVED";
  latitude: number;
  longitude: number;
  addressText: string | null;
  reportedAt: Date;
  falseReviewCount: number;
  currentReviewStatus: "VIEWED" | "VALID" | "FALSE" | null;
};

export async function listCoveredOrganizationIncidents(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    west: number;
    south: number;
    east: number;
    north: number;
    limit: number;
    cursor: OrganizationIncidentDiscoveryCursor | null;
    status?: OrganizationIncidentDiscoveryRow["status"];
    categoryId?: string;
    reportedAfter?: Date;
  },
): Promise<OrganizationIncidentDiscoveryRow[]> {
  const statusFilter = input.status
    ? Prisma.sql`AND incident."status" = ${input.status}::"IncidentStatus"`
    : Prisma.sql`AND incident."status" <> 'ARCHIVED'::"IncidentStatus"`;
  const categoryFilter = input.categoryId
    ? Prisma.sql`AND incident."category_id" = ${input.categoryId}::uuid`
    : Prisma.empty;
  const reportedAfterFilter = input.reportedAfter
    ? Prisma.sql`AND incident."reported_at" >= ${input.reportedAfter}`
    : Prisma.empty;
  const cursorFilter = input.cursor
    ? Prisma.sql`
        AND (incident."reported_at", incident."id") <
          (${input.cursor.reportedAt}, ${input.cursor.id}::uuid)
      `
    : Prisma.empty;
  const viewportFilter = Prisma.sql`
          AND extensions.ST_Intersects(
            incident."geo_point",
            extensions.ST_MakeEnvelope(
              ${input.west}::double precision,
              ${input.south}::double precision,
              ${input.east}::double precision,
              ${input.north}::double precision,
              4326
            )::extensions.geography
          )
          AND extensions.ST_Covers(
            extensions.ST_MakeEnvelope(
              ${input.west}::double precision,
              ${input.south}::double precision,
              ${input.east}::double precision,
              ${input.north}::double precision,
              4326
            )::extensions.geography,
            incident."geo_point"
          )
        `;

  return prisma.$queryRaw<OrganizationIncidentDiscoveryRow[]>`
    SELECT
      incident."id",
      incident."title",
      category."id" AS "categoryId",
      category."name" AS "categoryName",
      category."description" AS "categoryDescription",
      incident."severity"::text AS "severity",
      incident."status"::text AS "status",
      incident."latitude"::double precision AS "latitude",
      incident."longitude"::double precision AS "longitude",
      incident."address_text" AS "addressText",
      incident."reported_at" AS "reportedAt",
      (
        SELECT COUNT(DISTINCT review."organization_id")::integer
        FROM "incident_reviews" AS review
        JOIN "organizations" AS reviewing_organization
          ON reviewing_organization."id" = review."organization_id"
         AND reviewing_organization."status" = 'ACTIVE'::"OrganizationStatus"
        WHERE review."incident_id" = incident."id"
          AND review."status" = 'FALSE'::"IncidentReviewStatus"
      ) AS "falseReviewCount",
      (
        SELECT review."status"::text
        FROM "incident_reviews" AS review
        WHERE review."incident_id" = incident."id"
          AND review."organization_id" = ${input.organizationId}::uuid
        LIMIT 1
      ) AS "currentReviewStatus"
    FROM "incidents" AS incident
    JOIN "incident_categories" AS category
      ON category."id" = incident."category_id"
    WHERE (
        EXISTS (
          SELECT 1
          FROM "organization_service_areas" AS service_area
          JOIN "organizations" AS organization
            ON organization."id" = service_area."organization_id"
           AND organization."status" = 'ACTIVE'::"OrganizationStatus"
          LEFT JOIN "administrative_areas" AS administrative_area
            ON administrative_area."id" = service_area."administrative_area_id"
           AND administrative_area."is_active" = true
          WHERE service_area."organization_id" = ${input.organizationId}::uuid
            AND service_area."status" = 'ACTIVE'::"ServiceAreaStatus"
            AND extensions.ST_Covers(
              COALESCE(service_area."boundary", administrative_area."boundary"),
              incident."geo_point"
            )
        )
        OR EXISTS (
          SELECT 1
          FROM "incident_reviews" AS retained_review
          WHERE retained_review."incident_id" = incident."id"
            AND retained_review."organization_id" = ${input.organizationId}::uuid
        )
        OR EXISTS (
          SELECT 1
          FROM "cleanup_events" AS retained_event
          WHERE retained_event."incident_id" = incident."id"
            AND retained_event."organization_id" = ${input.organizationId}::uuid
        )
      )
      ${viewportFilter}
      ${statusFilter}
      ${categoryFilter}
      ${reportedAfterFilter}
      ${cursorFilter}
    ORDER BY incident."reported_at" DESC, incident."id" DESC
    LIMIT ${input.limit + 1}
  `;
}
