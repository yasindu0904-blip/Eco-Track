import { ApplicationError } from "../../../errors/applicationError.js";
import { observeSpatialQuery } from "../../maps/map.telemetry.js";
import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";
import type {
  CleanupEventDisplayStatus,
  CleanupEventDraftDto,
  CleanupEventDraftPageDto,
  CleanupEventLifecycleStatus,
  CleanupEventMapFeatureCollectionDto,
  CleanupEventOwnedPageDto,
  CleanupEventOwnedSummaryDto,
  CleanupEventPublicDetailDto,
  CleanupEventPublicPageDto,
  CleanupEventPublicSummaryDto,
  CleanupEventPublishReadinessDto,
  CleanupEventPublishResultDto,
} from "../cleanupEvent.types.js";
import type {
  ValidatedCleanupEventListQuery,
  ValidatedCleanupEventMapQuery,
  ValidatedCleanupEventNearbyMapQuery,
  ValidatedCreateDraft,
  ValidatedDraftListQuery,
  ValidatedUpdateDraft,
} from "../cleanupEvent.validation.js";
import { uuidSchema } from "../cleanupEvent.validation.js";
import {
  assignCoordinatorRecord,
  createDraftRecord,
  discardDraftRecord,
  findActiveOrganizationMembership,
  findDraftEventById,
  findDraftWorkflowStatusId,
  findOrganizationDraftById,
  findOrganizationDrafts,
  findOwnedCleanupEventById,
  findPublicCleanupEventById,
  findVisibleIncidentLocation,
  listNearbyPublicCleanupEventMapRecords,
  listOrganizationCleanupEventMapRecords,
  listOwnedCleanupEventRecords,
  listPublicCleanupEventMapRecords,
  listPublicCleanupEventRecords,
  removeCoordinatorRecord,
  updateDraftRecord,
  type CleanupEventDraftCursor,
  type CleanupEventDraftRecord,
  type CleanupEventMapCursor,
  type CleanupEventPublicRecord,
} from "../repositories/cleanupEvent.repository.js";
import {
  getCleanupEventPublishReadiness,
  publishCleanupEvent,
} from "../use-cases/publishCleanupEvent.useCase.js";

function normalizedLifecycle(status: string): CleanupEventLifecycleStatus {
  if (["SCHEDULED", "IN_PROGRESS", "COMPLETION_SUBMITTED"].includes(status))
    return "PUBLISHED";
  if (["DRAFT", "PUBLISHED", "COMPLETED", "CANCELLED"].includes(status))
    return status as CleanupEventLifecycleStatus;
  throw new ApplicationError(
    500,
    "EVENT_STATE_INVALID",
    "The cleanup event has an unsupported lifecycle state.",
  );
}

export function cleanupEventDisplayStatus(
  lifecycleStatus: CleanupEventLifecycleStatus,
  startsAt: Date | null,
  now = new Date(),
): CleanupEventDisplayStatus {
  if (lifecycleStatus !== "PUBLISHED") return lifecycleStatus;
  return startsAt && startsAt.getTime() > now.getTime()
    ? "UPCOMING"
    : "ONGOING";
}

function toDraftDto(record: CleanupEventDraftRecord): CleanupEventDraftDto {
  return {
    id: record.id,
    organizationId: record.organizationId,
    incidentId: record.incidentId,
    lifecycleStatus: "DRAFT",
    displayStatus: "DRAFT",
    title: record.title,
    description: record.description,
    publicInstructions: record.publicInstructions,
    eventLatitude: Number(record.eventLatitude),
    eventLongitude: Number(record.eventLongitude),
    eventAddress: record.eventAddress,
    meetingLatitude:
      record.meetingLatitude === null ? null : Number(record.meetingLatitude),
    meetingLongitude:
      record.meetingLongitude === null ? null : Number(record.meetingLongitude),
    meetingAddress: record.meetingAddress,
    startsAt: record.startsAt?.toISOString() ?? null,
    capacity: record.capacity,
    locationLockedToIncident: record.incidentId !== null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    coordinators: record.coordinators.map((coordinator) => ({
      id: coordinator.id,
      membershipId: coordinator.membershipId,
      assignedAt: coordinator.assignedAt.toISOString(),
      member: {
        id: coordinator.membership.user.id,
        fullName: coordinator.membership.user.fullName,
        email: coordinator.membership.user.email,
        role: coordinator.membership.role,
      },
    })),
  };
}

function requirePublicDates(record: CleanupEventPublicRecord): {
  publishedAt: Date;
  startsAt: Date;
} {
  if (!record.publishedAt || !record.startsAt) {
    throw new ApplicationError(
      500,
      "PUBLIC_EVENT_DATE_MISSING",
      "The published event schedule is unavailable.",
    );
  }
  return { publishedAt: record.publishedAt, startsAt: record.startsAt };
}

function toPublicSummary(
  record: CleanupEventPublicRecord,
): CleanupEventPublicSummaryDto {
  const dates = requirePublicDates(record);
  const lifecycleStatus = normalizedLifecycle(record.lifecycleStatus);
  if (lifecycleStatus === "DRAFT") {
    throw new ApplicationError(
      500,
      "PUBLIC_EVENT_STATE_INVALID",
      "A private event cannot be returned publicly.",
    );
  }
  return {
    id: record.id,
    organization: record.organization,
    incidentId: record.incidentId,
    title: record.title,
    description: record.description,
    lifecycleStatus,
    displayStatus: cleanupEventDisplayStatus(
      lifecycleStatus,
      dates.startsAt,
    ) as Exclude<CleanupEventDisplayStatus, "DRAFT">,
    eventLatitude: Number(record.eventLatitude),
    eventLongitude: Number(record.eventLongitude),
    eventAddress: record.eventAddress,
    startsAt: dates.startsAt.toISOString(),
    capacity: record.capacity,
    publishedAt: dates.publishedAt.toISOString(),
  };
}

function toPublicDetail(
  record: CleanupEventPublicRecord,
): CleanupEventPublicDetailDto {
  return {
    ...toPublicSummary(record),
    publicInstructions: record.publicInstructions ?? "",
    meetingLatitude:
      record.meetingLatitude === null ? null : Number(record.meetingLatitude),
    meetingLongitude:
      record.meetingLongitude === null ? null : Number(record.meetingLongitude),
    meetingAddress: record.meetingAddress,
    joinedVolunteerCount: record._count.participants,
  };
}

function encodeCursor(value: { createdAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ createdAt: value.createdAt.toISOString(), id: value.id }),
    "utf8",
  ).toString("base64url");
}

function decodeCursor(cursor: string): CleanupEventDraftCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { createdAt?: unknown; id?: unknown };
    const id = uuidSchema.safeParse(parsed.id);
    const createdAt = new Date(String(parsed.createdAt));
    if (!id.success || Number.isNaN(createdAt.getTime())) throw new Error();
    return { createdAt, id: id.data };
  } catch {
    throw new ApplicationError(
      400,
      "CLEANUP_EVENT_CURSOR_INVALID",
      "The cleanup-event cursor is invalid.",
    );
  }
}

function decodeDatedCursor<T extends "publishedAt" | "updatedAt" | "startsAt">(
  cursor: string,
  field: T,
): { [K in T]: Date } & { id: string } {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const id = uuidSchema.safeParse(parsed.id);
    const date = new Date(String(parsed[field]));
    if (!id.success || Number.isNaN(date.getTime())) throw new Error();
    return { [field]: date, id: id.data } as { [K in T]: Date } & {
      id: string;
    };
  } catch {
    throw new ApplicationError(
      400,
      "CLEANUP_EVENT_CURSOR_INVALID",
      "The cleanup-event cursor is invalid.",
    );
  }
}

function encodeDatedCursor(
  field: "publishedAt" | "updatedAt" | "startsAt",
  date: Date,
  id: string,
): string {
  return Buffer.from(
    JSON.stringify({ [field]: date.toISOString(), id }),
    "utf8",
  ).toString("base64url");
}

async function resolveIncidentLocation(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  incidentId: string,
) {
  const location = await findVisibleIncidentLocation(
    dependencies.prisma,
    organizationId,
    incidentId,
  );
  if (!location)
    throw new ApplicationError(
      404,
      "INCIDENT_NOT_VISIBLE",
      "The specified incident is not visible to this organization.",
    );
  return location;
}

async function lockedDraftInput(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  input: ValidatedCreateDraft,
): Promise<ValidatedCreateDraft> {
  if (!input.incidentId) return input;
  const incident = await resolveIncidentLocation(
    dependencies,
    organizationId,
    input.incidentId,
  );
  return {
    ...input,
    eventLatitude: incident.latitude,
    eventLongitude: incident.longitude,
    meetingLatitude: incident.latitude,
    meetingLongitude: incident.longitude,
  };
}

export async function createDraft(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  membershipId: string,
  input: ValidatedCreateDraft,
): Promise<CleanupEventDraftDto> {
  const workflowStatusId = await findDraftWorkflowStatusId(
    dependencies.prisma,
    organizationId,
  );
  if (!workflowStatusId)
    throw new ApplicationError(
      409,
      "DRAFT_WORKFLOW_UNAVAILABLE",
      "This organization does not have an active draft workflow status.",
    );
  return toDraftDto(
    await createDraftRecord(
      dependencies.prisma,
      organizationId,
      membershipId,
      workflowStatusId,
      await lockedDraftInput(dependencies, organizationId, input),
    ),
  );
}

export async function updateDraft(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  draftId: string,
  input: ValidatedUpdateDraft,
): Promise<CleanupEventDraftDto> {
  const current = await findOrganizationDraftById(
    dependencies.prisma,
    organizationId,
    draftId,
  );
  if (!current)
    throw new ApplicationError(
      404,
      "DRAFT_NOT_FOUND",
      "The draft was not found or is no longer editable.",
    );
  let safeInput = input;
  const targetIncidentId = current.incidentId ?? input.incidentId;
  if (current.incidentId) {
    if (
      input.incidentId !== undefined &&
      input.incidentId !== current.incidentId
    ) {
      throw new ApplicationError(
        409,
        "INCIDENT_LINK_LOCKED",
        "A linked incident cannot be changed after the draft is created.",
      );
    }
  }
  if (targetIncidentId) {
    const incident = await resolveIncidentLocation(
      dependencies,
      organizationId,
      targetIncidentId,
    );
    safeInput = {
      ...input,
      incidentId: targetIncidentId,
      eventLatitude: incident.latitude,
      eventLongitude: incident.longitude,
      meetingLatitude: incident.latitude,
      meetingLongitude: incident.longitude,
    };
  }
  const updated = await updateDraftRecord(
    dependencies.prisma,
    organizationId,
    draftId,
    safeInput,
  );
  if (!updated)
    throw new ApplicationError(
      404,
      "DRAFT_NOT_FOUND",
      "The draft was not found or is no longer editable.",
    );
  return toDraftDto(updated);
}

export async function listOrganizationDrafts(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  query: ValidatedDraftListQuery,
): Promise<CleanupEventDraftPageDto> {
  const records = await findOrganizationDrafts(dependencies.prisma, {
    organizationId,
    cursor: query.cursor ? decodeCursor(query.cursor) : null,
    limit: query.limit,
  });
  const hasMore = records.length > query.limit;
  const page = hasMore ? records.slice(0, query.limit) : records;
  return {
    items: page.map(toDraftDto),
    nextCursor: hasMore && page.at(-1) ? encodeCursor(page.at(-1)!) : null,
  };
}

export async function getOrganizationDraft(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  id: string,
): Promise<CleanupEventDraftDto> {
  const draft = await findOrganizationDraftById(
    dependencies.prisma,
    organizationId,
    id,
  );
  if (!draft)
    throw new ApplicationError(
      404,
      "DRAFT_NOT_FOUND",
      "The draft was not found.",
    );
  return toDraftDto(draft);
}

export async function discardDraft(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  draftId: string,
): Promise<void> {
  if (!(await discardDraftRecord(dependencies.prisma, organizationId, draftId)))
    throw new ApplicationError(
      404,
      "DRAFT_NOT_FOUND",
      "The draft was not found or is no longer editable.",
    );
}

export async function assignCoordinator(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  eventId: string,
  membershipId: string,
  assignedByMembershipId: string,
) {
  if (!(await findDraftEventById(dependencies.prisma, organizationId, eventId)))
    throw new ApplicationError(
      404,
      "CLEANUP_EVENT_DRAFT_NOT_FOUND",
      "The cleanup-event draft was not found in this organization.",
    );
  if (
    !(await findActiveOrganizationMembership(
      dependencies.prisma,
      organizationId,
      membershipId,
    ))
  )
    throw new ApplicationError(
      400,
      "MEMBERSHIP_INVALID",
      "The coordinator must be an active member of this organization.",
    );
  return assignCoordinatorRecord(
    dependencies.prisma,
    eventId,
    membershipId,
    assignedByMembershipId,
  );
}

export async function removeCoordinator(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  eventId: string,
  membershipId: string,
): Promise<void> {
  if (!(await findDraftEventById(dependencies.prisma, organizationId, eventId)))
    throw new ApplicationError(
      404,
      "CLEANUP_EVENT_DRAFT_NOT_FOUND",
      "The cleanup-event draft was not found in this organization.",
    );
  if (
    !(await removeCoordinatorRecord(dependencies.prisma, eventId, membershipId))
  )
    throw new ApplicationError(
      404,
      "COORDINATOR_NOT_FOUND",
      "The active coordinator assignment was not found in this draft.",
    );
}

export function getPublishReadiness(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  eventId: string,
): Promise<CleanupEventPublishReadinessDto> {
  return getCleanupEventPublishReadiness(dependencies, organizationId, eventId);
}

export async function publishEvent(
  dependencies: CleanupEventDependencies,
  command: {
    organizationId: string;
    eventId: string;
    actorUserId: string;
    actorMembershipId: string;
  },
): Promise<CleanupEventPublishResultDto> {
  const result = await publishCleanupEvent(dependencies, command);
  const event = await findPublicCleanupEventById(
    dependencies.prisma,
    result.eventId,
  );
  if (!event)
    throw new ApplicationError(
      500,
      "PUBLISHED_EVENT_NOT_FOUND",
      "The published cleanup event could not be loaded.",
    );
  return {
    event: toPublicDetail(event),
    incidentUpdated: result.incidentUpdated,
  };
}

export async function listPublicCleanupEvents(
  dependencies: CleanupEventDependencies,
  query: ValidatedCleanupEventListQuery,
): Promise<CleanupEventPublicPageDto> {
  const field = query.section ? "startsAt" : "publishedAt";
  const decoded = query.cursor ? decodeDatedCursor(query.cursor, field) : null;
  const cursor = decoded ? { publishedAt: decoded[field], id: decoded.id } : null;
  const records = await listPublicCleanupEventRecords(dependencies.prisma, {
    cursor,
    limit: query.limit,
    section: query.section,
  });
  const hasMore = records.length > query.limit;
  const page = hasMore ? records.slice(0, query.limit) : records;
  const last = page.at(-1);
  return {
    items: page.map(toPublicSummary),
    nextCursor:
      hasMore && last?.publishedAt
        ? encodeDatedCursor(field, last[field]!, last.id)
        : null,
  };
}

export async function getPublicCleanupEvent(
  dependencies: CleanupEventDependencies,
  eventId: string,
): Promise<CleanupEventPublicDetailDto> {
  const record = await findPublicCleanupEventById(dependencies.prisma, eventId);
  if (!record)
    throw new ApplicationError(
      404,
      "CLEANUP_EVENT_NOT_FOUND",
      "The public cleanup event was not found.",
    );
  return toPublicDetail(record);
}

function toOwnedSummary(
  record: CleanupEventPublicRecord,
): CleanupEventOwnedSummaryDto {
  const lifecycleStatus = normalizedLifecycle(record.lifecycleStatus);
  return {
    id: record.id,
    organization: record.organization,
    incidentId: record.incidentId,
    title: record.title,
    description: record.description,
    lifecycleStatus,
    displayStatus: cleanupEventDisplayStatus(lifecycleStatus, record.startsAt),
    eventLatitude: Number(record.eventLatitude),
    eventLongitude: Number(record.eventLongitude),
    eventAddress: record.eventAddress,
    startsAt: record.startsAt?.toISOString() ?? null,
    capacity: record.capacity,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function getOwnedCleanupEvent(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  eventId: string,
): Promise<CleanupEventOwnedSummaryDto> {
  const record = await findOwnedCleanupEventById(
    dependencies.prisma,
    organizationId,
    eventId,
  );
  if (!record)
    throw new ApplicationError(
      404,
      "CLEANUP_EVENT_NOT_FOUND",
      "The organization cleanup event was not found.",
    );
  return toOwnedSummary(record);
}

export async function listOwnedCleanupEvents(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  membership: { id: string; role: "ORG_MEMBER" | "ORG_ADMIN" },
  query: ValidatedCleanupEventListQuery,
): Promise<CleanupEventOwnedPageDto> {
  const field = query.section ? "startsAt" : "updatedAt";
  const decoded = query.cursor ? decodeDatedCursor(query.cursor, field) : null;
  const cursor = decoded ? { updatedAt: decoded[field], id: decoded.id } : null;
  const records = await listOwnedCleanupEventRecords(dependencies.prisma, {
    organizationId,
    ...(membership.role === "ORG_MEMBER"
      ? { coordinatorMembershipId: membership.id }
      : {}),
    cursor,
    limit: query.limit,
    section: query.section,
  });
  const hasMore = records.length > query.limit;
  const page = hasMore ? records.slice(0, query.limit) : records;
  const last = page.at(-1);
  return {
    items: page.map(toOwnedSummary),
    nextCursor:
      hasMore && last
        ? encodeDatedCursor(field, last[field]!, last.id)
        : null,
  };
}

export async function listPublicCleanupEventMap(
  dependencies: CleanupEventDependencies,
  query: ValidatedCleanupEventMapQuery,
  userId: string,
): Promise<CleanupEventMapFeatureCollectionDto> {
  const decoded = query.cursor
    ? decodeDatedCursor(query.cursor, "publishedAt")
    : null;
  const cursor = decoded
    ? ({
        sortAt: decoded.publishedAt,
        id: decoded.id,
      } satisfies CleanupEventMapCursor)
    : null;
  const records = await observeSpatialQuery(
    dependencies.spatialQueryObserver,
    {
      operation: "cleanup_events.public",
      projection: "PUBLIC",
      mode: "VIEWPORT",
    },
    () =>
      listPublicCleanupEventMapRecords(dependencies.prisma, {
        ...query,
        cursor,
        userId,
      }),
  );
  return toMapPage(records, query.limit, "publishedAt", false);
}

export async function listNearbyPublicCleanupEventMap(
  dependencies: CleanupEventDependencies,
  query: ValidatedCleanupEventNearbyMapQuery,
  userId: string,
): Promise<CleanupEventMapFeatureCollectionDto> {
  const field = query.section ? "startsAt" : "publishedAt";
  const decoded = query.cursor
    ? decodeDatedCursor(query.cursor, field)
    : null;
  const cursor = decoded
    ? { sortAt: decoded[field], id: decoded.id }
    : null;
  const records = await observeSpatialQuery(
    dependencies.spatialQueryObserver,
    {
      operation: "cleanup_events.public",
      projection: "PUBLIC",
      mode: "RADIUS",
    },
    () =>
      listNearbyPublicCleanupEventMapRecords(dependencies.prisma, {
        ...query,
        cursor,
        userId,
      }),
  );
  return toMapPage(records, query.limit, field, false);
}

export async function listOrganizationCleanupEventMap(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  query: ValidatedCleanupEventMapQuery,
): Promise<CleanupEventMapFeatureCollectionDto> {
  const decoded = query.cursor
    ? decodeDatedCursor(query.cursor, "updatedAt")
    : null;
  const cursor = decoded ? { sortAt: decoded.updatedAt, id: decoded.id } : null;
  const records = await observeSpatialQuery(
    dependencies.spatialQueryObserver,
    {
      operation: "cleanup_events.organization",
      projection: "ORGANIZATION",
      mode: "VIEWPORT",
    },
    () =>
      listOrganizationCleanupEventMapRecords(dependencies.prisma, {
        ...query,
        organizationId,
        cursor,
      }),
  );
  return toMapPage(records, query.limit, "updatedAt", organizationId);
}

function toMapPage(
  records: Awaited<ReturnType<typeof listPublicCleanupEventMapRecords>>,
  limit: number,
  cursorField: "publishedAt" | "updatedAt" | "startsAt",
  isOwned: boolean | string,
): CleanupEventMapFeatureCollectionDto {
  const hasMore = records.length > limit;
  const page = hasMore ? records.slice(0, limit) : records;
  const last = page.at(-1);
  return {
    type: "FeatureCollection",
    features: page.map((record) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [record.longitude, record.latitude],
      },
      properties: {
        id: record.id,
        kind: "CLEANUP_EVENT",
        title: record.title,
        status: cleanupEventDisplayStatus(
          normalizedLifecycle(record.lifecycleStatus),
          record.startsAt,
        ),
        occurredAt: (record.publishedAt ?? record.updatedAt).toISOString(),
        organizationId: record.organizationId,
        organizationName: record.organizationName,
        incidentId: record.incidentId,
        isJoined: record.isJoined,
        isOwned: typeof isOwned === "string" ? record.organizationId === isOwned : isOwned,
      },
    })),
    nextCursor:
      hasMore && last
        ? encodeDatedCursor(
            cursorField,
            last[cursorField]!,
            last.id,
          )
        : null,
  };
}
