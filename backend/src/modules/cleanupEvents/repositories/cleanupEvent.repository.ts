import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";

import type {
  ValidatedCreateDraft,
  ValidatedCreateSession,
  ValidatedCleanupEventMapQuery,
  ValidatedUpdateDraft,
} from "../cleanupEvent.validation.js";

export const publicCleanupEventLifecycleStatuses = [
  "PUBLISHED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETION_SUBMITTED",
] as const;

export const visibleCleanupEventLifecycleStatuses = [
  ...publicCleanupEventLifecycleStatuses,
  "COMPLETED",
  "CANCELLED",
] as const;

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

export type CleanupEventPublicCursor = {
  publishedAt: Date;
  id: string;
};

export type CleanupEventOwnedCursor = {
  updatedAt: Date;
  id: string;
};

const publicEventSelect = {
  id: true,
  organizationId: true,
  incidentId: true,
  lifecycleStatus: true,
  title: true,
  description: true,
  publicInstructions: true,
  eventLatitude: true,
  eventLongitude: true,
  eventAddress: true,
  meetingLatitude: true,
  meetingLongitude: true,
  meetingAddress: true,
  publishedAt: true,
  updatedAt: true,
  organization: { select: { id: true, name: true } },
  sessions: {
    where: { status: { not: "CANCELLED" } },
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      sessionDate: true,
      startTime: true,
      endTime: true,
      capacity: true,
      locationLatitude: true,
      locationLongitude: true,
      locationAddress: true,
    },
  },
} satisfies Prisma.CleanupEventSelect;

export type CleanupEventPublicRecord = Prisma.CleanupEventGetPayload<{
  select: typeof publicEventSelect;
}>;

export const publishCandidateInclude = {
  organization: { select: { id: true, name: true, status: true } },
  currentWorkflowStatus: true,
  sessions: { orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }] },
  coordinators: {
    where: { removedAt: null },
    include: {
      membership: {
        select: { id: true, userId: true, organizationId: true, status: true },
      },
    },
  },
  incident: {
    include: {
      reviews: true,
    },
  },
} satisfies Prisma.CleanupEventInclude;

export type CleanupEventPublishCandidate = Prisma.CleanupEventGetPayload<{
  include: typeof publishCandidateInclude;
}>;

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

export function findPublishCandidate(
  prisma: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
  eventId: string,
): Promise<CleanupEventPublishCandidate | null> {
  return prisma.cleanupEvent.findFirst({
    where: { id: eventId, organizationId },
    include: publishCandidateInclude,
  });
}

export function findPublishedWorkflowTransition(
  prisma: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
  fromStatusId: string,
) {
  return prisma.cleanupWorkflowTransition.findFirst({
    where: {
      organizationId,
      fromStatusId,
      fromStatus: { isActive: true },
      toStatus: { mappedLifecycleStatus: "PUBLISHED", isActive: true },
    },
    include: { toStatus: true },
  });
}

export function findClaimingEventForIncident(
  prisma: PrismaClient | Prisma.TransactionClient,
  incidentId: string,
  excludedEventId?: string,
) {
  return prisma.cleanupEvent.findFirst({
    where: {
      incidentId,
      lifecycleStatus: { in: [...publicCleanupEventLifecycleStatuses] },
      ...(excludedEventId ? { id: { not: excludedEventId } } : {}),
    },
    select: { id: true, title: true },
  });
}

export async function publishCleanupEventRecord(
  prisma: Prisma.TransactionClient,
  command: {
    organizationId: string;
    eventId: string;
    actorUserId: string;
    actorMembershipId: string;
    fromWorkflowStatusId: string;
    toWorkflowStatusId: string;
    incidentId: string | null;
    incidentFromStatus: "ACTIVE" | "EXPIRED" | null;
    publishedAt: Date;
  },
): Promise<boolean> {
  const updated = await prisma.cleanupEvent.updateMany({
    where: {
      id: command.eventId,
      organizationId: command.organizationId,
      lifecycleStatus: "DRAFT",
      currentWorkflowStatusId: command.fromWorkflowStatusId,
    },
    data: {
      lifecycleStatus: "PUBLISHED",
      currentWorkflowStatusId: command.toWorkflowStatusId,
      publishedAt: command.publishedAt,
    },
  });
  if (updated.count !== 1) return false;

  await prisma.eventStatusHistory.create({
    data: {
      cleanupEventId: command.eventId,
      fromWorkflowStatusId: command.fromWorkflowStatusId,
      toWorkflowStatusId: command.toWorkflowStatusId,
      changedByMembershipId: command.actorMembershipId,
      notes: "Cleanup event published.",
      changedAt: command.publishedAt,
    },
  });

  if (command.incidentId && command.incidentFromStatus) {
    const incidentUpdated = await prisma.incident.updateMany({
      where: {
        id: command.incidentId,
        status: command.incidentFromStatus,
      },
      data: { status: "CLEANUP_ORGANIZED" },
    });
    if (incidentUpdated.count !== 1) return false;
    await prisma.incidentStatusHistory.create({
      data: {
        incidentId: command.incidentId,
        fromStatus: command.incidentFromStatus,
        toStatus: "CLEANUP_ORGANIZED",
        changedByUserId: command.actorUserId,
        relatedCleanupEventId: command.eventId,
        reason: "A cleanup event was published for this incident.",
        changedAt: command.publishedAt,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: command.actorUserId,
      organizationId: command.organizationId,
      action: "CLEANUP_EVENT_PUBLISHED",
      entityType: "CleanupEvent",
      entityId: command.eventId,
      metadata: command.incidentId ? { incidentId: command.incidentId } : undefined,
    },
  });

  return true;
}

export function findPublicCleanupEventById(
  prisma: PrismaClient | Prisma.TransactionClient,
  eventId: string,
): Promise<CleanupEventPublicRecord | null> {
  return prisma.cleanupEvent.findFirst({
    where: {
      id: eventId,
      lifecycleStatus: { in: [...visibleCleanupEventLifecycleStatuses] },
      publishedAt: { not: null },
      organization: { status: "ACTIVE" },
    },
    select: publicEventSelect,
  });
}

export function listPublicCleanupEventRecords(
  prisma: PrismaClient,
  command: { cursor: CleanupEventPublicCursor | null; limit: number },
): Promise<CleanupEventPublicRecord[]> {
  return prisma.cleanupEvent.findMany({
    where: {
      lifecycleStatus: { in: [...publicCleanupEventLifecycleStatuses] },
      publishedAt: { not: null },
      organization: { status: "ACTIVE" },
      ...(command.cursor
        ? {
            OR: [
              { publishedAt: { lt: command.cursor.publishedAt } },
              {
                publishedAt: command.cursor.publishedAt,
                id: { lt: command.cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: command.limit + 1,
    select: publicEventSelect,
  });
}

export function listOwnedCleanupEventRecords(
  prisma: PrismaClient,
  command: {
    organizationId: string;
    cursor: CleanupEventOwnedCursor | null;
    limit: number;
  },
): Promise<CleanupEventPublicRecord[]> {
  return prisma.cleanupEvent.findMany({
    where: {
      organizationId: command.organizationId,
      ...(command.cursor
        ? {
            OR: [
              { updatedAt: { lt: command.cursor.updatedAt } },
              {
                updatedAt: command.cursor.updatedAt,
                id: { lt: command.cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: command.limit + 1,
    select: publicEventSelect,
  });
}

export type CleanupEventMapRow = {
  id: string;
  title: string;
  lifecycleStatus: string;
  latitude: number;
  longitude: number;
  publishedAt: Date;
};

export function listPublicCleanupEventMapRecords(
  prisma: PrismaClient,
  query: ValidatedCleanupEventMapQuery,
): Promise<CleanupEventMapRow[]> {
  const cursor = query.cursor
    ? Prisma.sql`AND event."id" < ${query.cursor}::uuid`
    : Prisma.empty;
  return prisma.$queryRaw<CleanupEventMapRow[]>(Prisma.sql`
    SELECT
      event."id",
      event."title",
      event."lifecycle_status"::text AS "lifecycleStatus",
      event."event_latitude"::double precision AS "latitude",
      event."event_longitude"::double precision AS "longitude",
      event."published_at" AS "publishedAt"
    FROM "cleanup_events" AS event
    JOIN "organizations" AS organization
      ON organization."id" = event."organization_id"
     AND organization."status" = 'ACTIVE'::"OrganizationStatus"
    WHERE event."lifecycle_status" IN (
      'PUBLISHED'::"CleanupLifecycleStatus",
      'SCHEDULED'::"CleanupLifecycleStatus",
      'IN_PROGRESS'::"CleanupLifecycleStatus",
      'COMPLETION_SUBMITTED'::"CleanupLifecycleStatus"
    )
      AND event."published_at" IS NOT NULL
      AND extensions.ST_Covers(
        extensions.ST_MakeEnvelope(
          ${query.west}::double precision,
          ${query.south}::double precision,
          ${query.east}::double precision,
          ${query.north}::double precision,
          4326
        )::extensions.geography,
        event."event_geo_point"
      )
      ${cursor}
    ORDER BY event."id" DESC
    LIMIT ${query.limit + 1}
  `);
}
