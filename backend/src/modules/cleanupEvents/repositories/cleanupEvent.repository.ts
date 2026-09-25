import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";

import type {
  ValidatedCreateDraft,
  ValidatedUpdateDraft,
} from "../cleanupEvent.validation.js";

export const publicCleanupEventLifecycleStatuses = ["PUBLISHED"] as const;

export const visibleCleanupEventLifecycleStatuses = [
  ...publicCleanupEventLifecycleStatuses,
  "COMPLETED",
  "CANCELLED",
] as const;

export const cleanupEventDraftInclude = {
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
  startsAt: true,
  capacity: true,
  publishedAt: true,
  updatedAt: true,
  organization: { select: { id: true, name: true } },
  _count: { select: { participants: { where: { status: "JOINED" } } } },
} satisfies Prisma.CleanupEventSelect;

export type CleanupEventPublicRecord = Prisma.CleanupEventGetPayload<{
  select: typeof publicEventSelect;
}>;

export const publishCandidateInclude = {
  organization: {
    select: {
      id: true,
      name: true,
      status: true,
      memberships: {
        where: { role: "ORG_ADMIN", status: "ACTIVE" },
        select: { userId: true },
      },
    },
  },
  currentWorkflowStatus: true,
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

export async function findVisibleIncidentLocation(
  prisma: PrismaClient,
  organizationId: string,
  incidentId: string,
): Promise<{
  latitude: number;
  longitude: number;
  addressText: string | null;
} | null> {
  const rows = await prisma.$queryRaw<
    Array<{ latitude: number; longitude: number; addressText: string | null }>
  >(Prisma.sql`
    SELECT incident."latitude"::double precision AS "latitude",
           incident."longitude"::double precision AS "longitude",
           incident."address_text" AS "addressText"
    FROM "incidents" AS incident
    WHERE incident."id" = ${incidentId}::uuid
      AND EXISTS (
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
    LIMIT 1
  `);
  return rows[0] ?? null;
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
      eventLatitude: data.eventLatitude!,
      eventLongitude: data.eventLongitude!,
      eventAddress: data.eventAddress || null,
      meetingLatitude: data.meetingLatitude ?? null,
      meetingLongitude: data.meetingLongitude ?? null,
      meetingAddress: data.meetingAddress || null,
      startsAt: data.startsAt,
      capacity: data.capacity ?? null,
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
      metadata: command.incidentId
        ? { incidentId: command.incidentId }
        : undefined,
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

export function findOwnedCleanupEventById(
  prisma: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
  eventId: string,
): Promise<CleanupEventPublicRecord | null> {
  return prisma.cleanupEvent.findFirst({
    where: { id: eventId, organizationId },
    select: publicEventSelect,
  });
}

export type EventSection = "upcoming" | "ongoing" | "past" | "cancelled";

export function eventSectionWhere(section?: EventSection, now = new Date()): Prisma.CleanupEventWhereInput {
  if (section === "past") return { lifecycleStatus: "COMPLETED" };
  if (section === "cancelled") return { lifecycleStatus: "CANCELLED" };
  if (section === "upcoming") return { lifecycleStatus: "PUBLISHED", startsAt: { gt: now } };
  if (section === "ongoing") return { lifecycleStatus: "PUBLISHED", startsAt: { lte: now } };
  return {};
}

export function listPublicCleanupEventRecords(
  prisma: PrismaClient,
  command: { cursor: CleanupEventPublicCursor | null; limit: number; section?: EventSection },
): Promise<CleanupEventPublicRecord[]> {
  const field = command.section ? "startsAt" : "publishedAt";
  const direction = command.section === "upcoming" ? "asc" : "desc";
  const comparison = direction === "asc" ? "gt" : "lt";
  return prisma.cleanupEvent.findMany({
    where: {
      lifecycleStatus: { in: [...publicCleanupEventLifecycleStatuses] },
      ...eventSectionWhere(command.section),
      publishedAt: { not: null },
      organization: { status: "ACTIVE" },
      ...(command.cursor
        ? {
            OR: [
              { [field]: { [comparison]: command.cursor.publishedAt } },
              {
                [field]: command.cursor.publishedAt,
                id: { [comparison]: command.cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ [field]: direction }, { id: direction }],
    take: command.limit + 1,
    select: publicEventSelect,
  });
}

export function listOwnedCleanupEventRecords(
  prisma: PrismaClient,
  command: {
    organizationId: string;
    coordinatorMembershipId?: string;
    section?: EventSection;
    cursor: CleanupEventOwnedCursor | null;
    limit: number;
  },
): Promise<CleanupEventPublicRecord[]> {
  const field = command.section ? "startsAt" : "updatedAt";
  const direction = command.section === "upcoming" ? "asc" : "desc";
  const comparison = direction === "asc" ? "gt" : "lt";
  return prisma.cleanupEvent.findMany({
    where: {
      organizationId: command.organizationId,
      ...eventSectionWhere(command.section),
      ...(command.coordinatorMembershipId
        ? {
            coordinators: {
              some: { membershipId: command.coordinatorMembershipId },
            },
          }
        : {}),
      ...(command.cursor
        ? {
            OR: [
              { [field]: { [comparison]: command.cursor.updatedAt } },
              {
                [field]: command.cursor.updatedAt,
                id: { [comparison]: command.cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ [field]: direction }, { id: direction }],
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
  startsAt: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
  organizationId: string;
  organizationName: string;
  incidentId: string | null;
  isJoined: boolean;
};

export type CleanupEventMapCursor = { sortAt: Date; id: string };

type PublicCleanupEventMapInput = {
  section?: EventSection;
  limit: number;
  cursor: CleanupEventMapCursor | null;
  userId: string;
};

const publicMapStatuses = Prisma.sql`
  'PUBLISHED'::"CleanupLifecycleStatus"
`;

function publicMapCursor(cursor: CleanupEventMapCursor | null) {
  return cursor
    ? Prisma.sql`AND (event."published_at", event."id") < (${cursor.sortAt}, ${cursor.id}::uuid)`
    : Prisma.empty;
}

export function listPublicCleanupEventMapRecords(
  prisma: PrismaClient,
  query: PublicCleanupEventMapInput & {
    west: number;
    south: number;
    east: number;
    north: number;
  },
): Promise<CleanupEventMapRow[]> {
  const cursor = publicMapCursor(query.cursor);
  return prisma.$queryRaw<CleanupEventMapRow[]>(Prisma.sql`
    SELECT
      event."id",
      event."title",
      event."lifecycle_status"::text AS "lifecycleStatus",
      event."event_latitude"::double precision AS "latitude",
      event."event_longitude"::double precision AS "longitude",
      event."starts_at" AS "startsAt",
      event."published_at" AS "publishedAt",
      event."updated_at" AS "updatedAt",
      event."organization_id" AS "organizationId",
      organization."name" AS "organizationName",
      event."incident_id" AS "incidentId",
      EXISTS (
        SELECT 1 FROM "event_participants" participant
        WHERE participant."cleanup_event_id" = event."id"
          AND participant."user_id" = ${query.userId}::uuid
          AND participant."status" = 'JOINED'::"ParticipantStatus"
      ) AS "isJoined"
    FROM "cleanup_events" AS event
    JOIN "organizations" AS organization
      ON organization."id" = event."organization_id"
     AND organization."status" = 'ACTIVE'::"OrganizationStatus"
    WHERE event."lifecycle_status" IN (${publicMapStatuses})
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
    ORDER BY event."published_at" DESC, event."id" DESC
    LIMIT ${query.limit + 1}
  `);
}

export function listNearbyPublicCleanupEventMapRecords(
  prisma: PrismaClient,
  query: PublicCleanupEventMapInput & {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  },
): Promise<CleanupEventMapRow[]> {
  const ascending = query.section === "upcoming";
  const sortColumn = query.section ? Prisma.sql`event."starts_at"` : Prisma.sql`event."published_at"`;
  const order = ascending ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const compare = ascending ? Prisma.sql`>` : Prisma.sql`<`;
  const cursor = query.cursor ? Prisma.sql`AND (${sortColumn}, event."id") ${compare} (${query.cursor.sortAt}, ${query.cursor.id}::uuid)` : Prisma.empty;
  const lifecycle = query.section === "past" ? "COMPLETED" : query.section === "cancelled" ? "CANCELLED" : "PUBLISHED";
  const now = new Date();
  const timeFilter = query.section === "upcoming" ? Prisma.sql`AND event."starts_at" > ${now}`
    : query.section === "ongoing" ? Prisma.sql`AND event."starts_at" <= ${now}` : Prisma.empty;
  return prisma.$queryRaw<CleanupEventMapRow[]>(Prisma.sql`
    SELECT event."id", event."title",
      event."lifecycle_status"::text AS "lifecycleStatus",
      event."event_latitude"::double precision AS "latitude",
      event."event_longitude"::double precision AS "longitude",
      event."starts_at" AS "startsAt",
      event."published_at" AS "publishedAt", event."updated_at" AS "updatedAt",
      event."organization_id" AS "organizationId", organization."name" AS "organizationName",
      event."incident_id" AS "incidentId",
      EXISTS (
        SELECT 1 FROM "event_participants" participant
        WHERE participant."cleanup_event_id" = event."id"
          AND participant."user_id" = ${query.userId}::uuid
          AND participant."status" = 'JOINED'::"ParticipantStatus"
      ) AS "isJoined"
    FROM "cleanup_events" event
    JOIN "organizations" organization ON organization."id" = event."organization_id"
      AND organization."status" = 'ACTIVE'::"OrganizationStatus"
    WHERE event."lifecycle_status" = ${lifecycle}::"CleanupLifecycleStatus"
      ${timeFilter}
      AND event."published_at" IS NOT NULL
      AND extensions.ST_DWithin(
        event."event_geo_point",
        extensions.ST_SetSRID(extensions.ST_MakePoint(
          ${query.longitude}::double precision, ${query.latitude}::double precision
        ), 4326)::extensions.geography,
        ${query.radiusMeters}::double precision
      )
      ${cursor}
    ORDER BY ${sortColumn} ${order}, event."id" ${order}
    LIMIT ${query.limit + 1}
  `);
}

export function listOrganizationCleanupEventMapRecords(
  prisma: PrismaClient,
  query: {
    organizationId: string;
    includePublic?: boolean;
    limit: number;
    cursor: CleanupEventMapCursor | null;
    west: number;
    south: number;
    east: number;
    north: number;
  },
): Promise<CleanupEventMapRow[]> {
  const cursor = query.cursor
    ? Prisma.sql`AND (event."updated_at", event."id") < (${query.cursor.sortAt}, ${query.cursor.id}::uuid)`
    : Prisma.empty;
  // Review discovery includes covered public activity and this tenant's private drafts.
  // The default map remains available to the separate owned-event management flow.
  const visibility = query.includePublic
    ? Prisma.sql`
        organization."status" = 'ACTIVE'::"OrganizationStatus"
        AND (
          (event."lifecycle_status" = 'PUBLISHED'::"CleanupLifecycleStatus" AND event."published_at" IS NOT NULL)
          OR (event."lifecycle_status" = 'DRAFT'::"CleanupLifecycleStatus"
            AND event."organization_id" = ${query.organizationId}::uuid)
        )
        AND EXISTS (
          SELECT 1
          FROM "organization_service_areas" AS service_area
          JOIN "organizations" AS viewing_organization
            ON viewing_organization."id" = service_area."organization_id"
            AND viewing_organization."status" = 'ACTIVE'::"OrganizationStatus"
          LEFT JOIN "administrative_areas" AS administrative_area
            ON administrative_area."id" = service_area."administrative_area_id"
            AND administrative_area."is_active" = true
          WHERE service_area."organization_id" = ${query.organizationId}::uuid
            AND service_area."status" = 'ACTIVE'::"ServiceAreaStatus"
            AND extensions.ST_Covers(
              COALESCE(service_area."boundary", administrative_area."boundary"),
              event."event_geo_point"
            )
        )`
    : Prisma.sql`event."organization_id" = ${query.organizationId}::uuid`;
  return prisma.$queryRaw<CleanupEventMapRow[]>(Prisma.sql`
    SELECT event."id", event."title",
      event."lifecycle_status"::text AS "lifecycleStatus",
      event."event_latitude"::double precision AS "latitude",
      event."event_longitude"::double precision AS "longitude",
      event."starts_at" AS "startsAt",
      event."published_at" AS "publishedAt", event."updated_at" AS "updatedAt",
      event."organization_id" AS "organizationId", organization."name" AS "organizationName",
      event."incident_id" AS "incidentId", false AS "isJoined"
    FROM "cleanup_events" event
    JOIN "organizations" organization ON organization."id" = event."organization_id"
    WHERE ${visibility}
      AND extensions.ST_Covers(
        extensions.ST_MakeEnvelope(${query.west}::double precision, ${query.south}::double precision,
          ${query.east}::double precision, ${query.north}::double precision, 4326)::extensions.geography,
        event."event_geo_point"
      )
      ${cursor}
    ORDER BY event."updated_at" DESC, event."id" DESC
    LIMIT ${query.limit + 1}
  `);
}
