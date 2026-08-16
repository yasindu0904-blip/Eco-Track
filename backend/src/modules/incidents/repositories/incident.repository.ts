import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";

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
