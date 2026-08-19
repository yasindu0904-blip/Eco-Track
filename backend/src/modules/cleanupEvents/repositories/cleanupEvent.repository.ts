import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";

import type {
  ValidatedCreateDraft,
  ValidatedCreateSession,
  ValidatedUpdateDraft,
} from "../cleanupEvent.validation.js";

export const cleanupEventDraftInclude = {
  sessions: {
    orderBy: [
      { sessionDate: "asc" },
      { startTime: "asc" },
    ],
  },
  coordinators: {
    where: { removedAt: null },
    orderBy: { assignedAt: "asc" },
    include: {
      membership: {
        select: {
          id: true,
          role: true,
          status: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CleanupEventInclude;

export type CleanupEventDraftRecord = Prisma.CleanupEventGetPayload<{
  include: typeof cleanupEventDraftInclude;
}>;

export type CleanupEventDraftCursor = {
  createdAt: Date;
  id: string;
};

export async function isIncidentVisibleToOrganization(
  prisma: PrismaClient,
  organizationId: string,
  incidentId: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT incident."id" FROM "incidents" AS incident
    WHERE incident."id" = ${incidentId}::uuid AND (
      EXISTS (
        SELECT 1 FROM "organization_service_areas" AS service_area
        JOIN "organizations" AS organization
          ON organization."id" = service_area."organization_id"
          AND organization."status" = 'ACTIVE'::"OrganizationStatus"
        LEFT JOIN "administrative_areas" AS administrative_area
          ON administrative_area."id" = service_area."administrative_area_id"
          AND administrative_area."is_active" = true
        WHERE service_area."organization_id" = ${organizationId}::uuid
          AND service_area."status" = 'ACTIVE'::"ServiceAreaStatus"
          AND extensions.ST_Covers(
            COALESCE(service_area."boundary", administrative_area."boundary"),
            incident."geo_point"
          )
      )
      OR EXISTS (
        SELECT 1 FROM "incident_reviews" AS review
        WHERE review."incident_id" = incident."id"
          AND review."organization_id" = ${organizationId}::uuid
      )
    )
    LIMIT 1
  `);
  return rows.length === 1;
}

export async function findDraftWorkflowStatusId(
  prisma: PrismaClient,
  organizationId: string,
): Promise<string | null> {
  const status = await prisma.cleanupWorkflowStatus.findFirst({
    where: {
      organizationId,
      mappedLifecycleStatus: "DRAFT",
      isActive: true,
    },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  return status?.id ?? null;
}

export function createDraftRecord(
  prisma: PrismaClient,
  organizationId: string,
  createdByMembershipId: string,
  workflowStatusId: string,
  data: ValidatedCreateDraft,
): Promise<CleanupEventDraftRecord> {
  return prisma.cleanupEvent.create({
    data: {
      organizationId,
      incidentId: data.incidentId ?? null,
      currentWorkflowStatusId: workflowStatusId,
      lifecycleStatus: "DRAFT",
      createdByMembershipId,
      title: data.title,
      description: data.description,
      publicInstructions: data.publicInstructions || null,
      eventLatitude: data.eventLatitude,
      eventLongitude: data.eventLongitude,
      eventAddress: data.eventAddress || null,
      meetingLatitude: data.meetingLatitude ?? null,
      meetingLongitude: data.meetingLongitude ?? null,
      meetingAddress: data.meetingAddress || null,
    },
    include: cleanupEventDraftInclude,
  });
}

export async function updateDraftRecord(
  prisma: PrismaClient,
  organizationId: string,
  draftId: string,
  data: ValidatedUpdateDraft,
): Promise<CleanupEventDraftRecord | null> {
  const updated = await prisma.cleanupEvent.updateMany({
    where: {
      id: draftId,
      organizationId,
      lifecycleStatus: "DRAFT",
    },
    data,
  });
  if (updated.count === 0) return null;
  return findOrganizationDraftById(prisma, organizationId, draftId);
}

export function findOrganizationDrafts(
  prisma: PrismaClient,
  command: {
    organizationId: string;
    cursor: CleanupEventDraftCursor | null;
    limit: number;
  },
): Promise<CleanupEventDraftRecord[]> {
  const cursorFilter = command.cursor
    ? {
        OR: [
          { createdAt: { lt: command.cursor.createdAt } },
          {
            createdAt: command.cursor.createdAt,
            id: { lt: command.cursor.id },
          },
        ],
      }
    : {};

  return prisma.cleanupEvent.findMany({
    where: {
      organizationId: command.organizationId,
      lifecycleStatus: "DRAFT",
      ...cursorFilter,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: command.limit + 1,
    include: cleanupEventDraftInclude,
  });
}

export function findOrganizationDraftById(
  prisma: PrismaClient,
  organizationId: string,
  id: string,
): Promise<CleanupEventDraftRecord | null> {
  return prisma.cleanupEvent.findFirst({
    where: { id, organizationId, lifecycleStatus: "DRAFT" },
    include: cleanupEventDraftInclude,
  });
}

export async function discardDraftRecord(
  prisma: PrismaClient,
  organizationId: string,
  draftId: string,
): Promise<boolean> {
  const deleted = await prisma.cleanupEvent.deleteMany({
    where: { id: draftId, organizationId, lifecycleStatus: "DRAFT" },
  });
  return deleted.count === 1;
}

function sessionData(data: ValidatedCreateSession) {
  return {
    sessionDate: new Date(`${data.sessionDate}T00:00:00.000Z`),
    startTime: new Date(`1970-01-01T${data.startTime}Z`),
    endTime: new Date(`1970-01-01T${data.endTime}Z`),
    capacity: data.capacity ?? null,
    locationLatitude: data.locationLatitude ?? null,
    locationLongitude: data.locationLongitude ?? null,
    locationAddress: data.locationAddress || null,
    notes: data.notes || null,
  };
}

export function createEventSessionRecord(
  prisma: PrismaClient,
  cleanupEventId: string,
  data: ValidatedCreateSession,
) {
  return prisma.eventSession.create({
    data: { cleanupEventId, ...sessionData(data) },
  });
}

export async function updateEventSessionRecord(
  prisma: PrismaClient,
  organizationId: string,
  eventId: string,
  sessionId: string,
  data: ValidatedCreateSession,
) {
  const session = await prisma.eventSession.findFirst({
    where: {
      id: sessionId,
      cleanupEventId: eventId,
      cleanupEvent: { organizationId, lifecycleStatus: "DRAFT" },
    },
    select: { id: true },
  });
  if (!session) return null;
  return prisma.eventSession.update({
    where: { id: sessionId },
    data: sessionData(data),
  });
}

export async function removeEventSessionRecord(
  prisma: PrismaClient,
  organizationId: string,
  eventId: string,
  sessionId: string,
): Promise<boolean> {
  const deleted = await prisma.eventSession.deleteMany({
    where: {
      id: sessionId,
      cleanupEventId: eventId,
      cleanupEvent: { organizationId, lifecycleStatus: "DRAFT" },
    },
  });
  return deleted.count === 1;
}

export function findDraftEventById(
  prisma: PrismaClient,
  organizationId: string,
  id: string,
) {
  return prisma.cleanupEvent.findFirst({
    where: { id, organizationId, lifecycleStatus: "DRAFT" },
    select: { id: true },
  });
}

export function findActiveOrganizationMembership(
  prisma: PrismaClient,
  organizationId: string,
  membershipId: string,
) {
  return prisma.organizationMembership.findFirst({
    where: { id: membershipId, organizationId, status: "ACTIVE" },
    select: { id: true },
  });
}

export function assignCoordinatorRecord(
  prisma: PrismaClient,
  cleanupEventId: string,
  membershipId: string,
  assignedByMembershipId: string,
) {
  return prisma.eventCoordinator.upsert({
    where: {
      cleanupEventId_membershipId: { cleanupEventId, membershipId },
    },
    update: {
      assignedByMembershipId,
      assignedAt: new Date(),
      removedAt: null,
    },
    create: {
      cleanupEventId,
      membershipId,
      assignedByMembershipId,
    },
  });
}

export async function removeCoordinatorRecord(
  prisma: PrismaClient,
  cleanupEventId: string,
  membershipId: string,
): Promise<boolean> {
  const updated = await prisma.eventCoordinator.updateMany({
    where: { cleanupEventId, membershipId, removedAt: null },
    data: { removedAt: new Date() },
  });
  return updated.count === 1;
}
