import { ApplicationError } from "../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";
import type {
  CleanupEventDraftDto,
  CleanupEventDraftPageDto,
  CleanupEventMapFeatureCollectionDto,
  CleanupEventOwnedPageDto,
  CleanupEventPublicDetailDto,
  CleanupEventPublicLifecycleStatus,
  CleanupEventPublicPageDto,
  CleanupEventPublicSummaryDto,
  CleanupEventPublishReadinessDto,
  CleanupEventPublishResultDto,
  CleanupEventSessionDto,
} from "../cleanupEvent.types.js";
import type {
  ValidatedCleanupEventListQuery,
  ValidatedCleanupEventMapQuery,
  ValidatedCreateDraft,
  ValidatedCreateSession,
  ValidatedDraftListQuery,
  ValidatedUpdateDraft,
} from "../cleanupEvent.validation.js";
import { uuidSchema } from "../cleanupEvent.validation.js";
import {
  assignCoordinatorRecord,
  createDraftRecord,
  createEventSessionRecord,
  discardDraftRecord,
  findActiveOrganizationMembership,
  findDraftEventById,
  findDraftWorkflowStatusId,
  findOrganizationDraftById,
  findOrganizationDrafts,
  findPublicCleanupEventById,
  listOwnedCleanupEventRecords,
  listPublicCleanupEventMapRecords,
  listPublicCleanupEventRecords,
  isIncidentVisibleToOrganization,
  removeCoordinatorRecord,
  removeEventSessionRecord,
  updateDraftRecord,
  updateEventSessionRecord,
  type CleanupEventDraftCursor,
  type CleanupEventDraftRecord,
  type CleanupEventOwnedCursor,
  type CleanupEventPublicCursor,
  type CleanupEventPublicRecord,
} from "../repositories/cleanupEvent.repository.js";
import {
  getCleanupEventPublishReadiness,
  publishCleanupEvent,
} from "../use-cases/publishCleanupEvent.useCase.js";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTime(date: Date): string {
  return date.toISOString().slice(11, 19);
}

function toSessionDto(session: CleanupEventDraftRecord["sessions"][number]): CleanupEventSessionDto {
  return {
    id: session.id,
    sessionDate: formatDate(session.sessionDate),
    startTime: formatTime(session.startTime),
    endTime: formatTime(session.endTime),
    capacity: session.capacity,
    locationLatitude: session.locationLatitude === null
      ? null
      : Number(session.locationLatitude),
    locationLongitude: session.locationLongitude === null
      ? null
      : Number(session.locationLongitude),
    locationAddress: session.locationAddress,
    notes: session.notes,
  };
}

function toDraftDto(record: CleanupEventDraftRecord): CleanupEventDraftDto {
  return {
    id: record.id,
    organizationId: record.organizationId,
    incidentId: record.incidentId,
    lifecycleStatus: "DRAFT",
    title: record.title,
    description: record.description,
    publicInstructions: record.publicInstructions,
    eventLatitude: Number(record.eventLatitude),
    eventLongitude: Number(record.eventLongitude),
    eventAddress: record.eventAddress,
    meetingLatitude: record.meetingLatitude === null
      ? null
      : Number(record.meetingLatitude),
    meetingLongitude: record.meetingLongitude === null
      ? null
      : Number(record.meetingLongitude),
    meetingAddress: record.meetingAddress,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    sessions: record.sessions.map(toSessionDto),
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

function encodeCursor(record: CleanupEventDraftRecord): string {
  return Buffer.from(
    JSON.stringify({ createdAt: record.createdAt.toISOString(), id: record.id }),
    "utf8",
  ).toString("base64url");
}

function decodeCursor(cursor: string): CleanupEventDraftCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { createdAt?: unknown; id?: unknown };
    const parsedId = uuidSchema.safeParse(parsed.id);
    if (typeof parsed.createdAt !== "string" || !parsedId.success) {
      throw new Error();
    }
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) throw new Error();
    return { createdAt, id: parsedId.data };
  } catch {
    throw new ApplicationError(
      400,
      "CLEANUP_EVENT_CURSOR_INVALID",
      "The cleanup-event draft cursor is invalid.",
    );
  }
}

function decodeDatedCursor<T extends "publishedAt" | "updatedAt">(
  cursor: string,
  field: T,
): { [K in T]: Date } & { id: string } {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const parsedId = uuidSchema.safeParse(parsed.id);
    if (typeof parsed[field] !== "string" || !parsedId.success) throw new Error();
    const date = new Date(parsed[field]);
    if (Number.isNaN(date.getTime())) throw new Error();
    return { [field]: date, id: parsedId.data } as { [K in T]: Date } & { id: string };
  } catch {
    throw new ApplicationError(
      400,
      "CLEANUP_EVENT_CURSOR_INVALID",
      "The cleanup-event cursor is invalid.",
    );
  }
}

function encodeDatedCursor(
  field: "publishedAt" | "updatedAt",
  date: Date,
  id: string,
): string {
  return Buffer.from(
    JSON.stringify({ [field]: date.toISOString(), id }),
    "utf8",
  ).toString("base64url");
}

function firstSessionAt(record: CleanupEventPublicRecord): string | null {
  const session = record.sessions[0];
  if (!session) return null;
  return `${formatDate(session.sessionDate)}T${formatTime(session.startTime)}+05:30`;
}

function publicLifecycleStatus(
  record: CleanupEventPublicRecord,
): CleanupEventPublicLifecycleStatus {
  if (record.lifecycleStatus === "DRAFT") {
    throw new ApplicationError(500, "PUBLIC_EVENT_STATE_INVALID", "A private event cannot be returned publicly.");
  }
  return record.lifecycleStatus;
}

function toPublicSummary(record: CleanupEventPublicRecord): CleanupEventPublicSummaryDto {
  if (!record.publishedAt) {
    throw new ApplicationError(500, "PUBLIC_EVENT_DATE_MISSING", "The published event date is unavailable.");
  }
  return {
    id: record.id,
    organization: record.organization,
    incidentId: record.incidentId,
    title: record.title,
    description: record.description,
    lifecycleStatus: publicLifecycleStatus(record),
    eventLatitude: Number(record.eventLatitude),
    eventLongitude: Number(record.eventLongitude),
    eventAddress: record.eventAddress,
    publishedAt: record.publishedAt.toISOString(),
    firstSessionAt: firstSessionAt(record),
  };
}

function toPublicDetail(record: CleanupEventPublicRecord): CleanupEventPublicDetailDto {
  return {
    ...toPublicSummary(record),
    publicInstructions: record.publicInstructions ?? "",
    meetingLatitude: record.meetingLatitude === null ? null : Number(record.meetingLatitude),
    meetingLongitude: record.meetingLongitude === null ? null : Number(record.meetingLongitude),
    meetingAddress: record.meetingAddress,
    sessions: record.sessions.map((session) => ({
      id: session.id,
      sessionDate: formatDate(session.sessionDate),
      startTime: formatTime(session.startTime),
      endTime: formatTime(session.endTime),
      capacity: session.capacity,
      locationLatitude: session.locationLatitude === null ? null : Number(session.locationLatitude),
      locationLongitude: session.locationLongitude === null ? null : Number(session.locationLongitude),
      locationAddress: session.locationAddress,
    })),
  };
}

async function requireVisibleIncident(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  incidentId: string,
): Promise<void> {
  const visible = await isIncidentVisibleToOrganization(
    dependencies.prisma,
    organizationId,
    incidentId,
  );
  if (!visible) {
    throw new ApplicationError(
      404,
      "INCIDENT_NOT_VISIBLE",
      "The specified incident is not visible to this organization.",
    );
  }
}

async function requireDraft(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  eventId: string,
): Promise<void> {
  const event = await findDraftEventById(
    dependencies.prisma,
    organizationId,
    eventId,
  );
  if (!event) {
    throw new ApplicationError(
      404,
      "CLEANUP_EVENT_DRAFT_NOT_FOUND",
      "The cleanup-event draft was not found in this organization.",
    );
  }
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
  if (!workflowStatusId) {
    throw new ApplicationError(
      409,
      "DRAFT_WORKFLOW_UNAVAILABLE",
      "This organization does not have an active draft workflow status.",
    );
  }
  if (input.incidentId) {
    await requireVisibleIncident(dependencies, organizationId, input.incidentId);
  }
  return toDraftDto(
    await createDraftRecord(
      dependencies.prisma,
      organizationId,
      membershipId,
      workflowStatusId,
      input,
    ),
  );
}

export async function updateDraft(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  draftId: string,
  input: ValidatedUpdateDraft,
): Promise<CleanupEventDraftDto> {
  if (input.incidentId) {
    await requireVisibleIncident(dependencies, organizationId, input.incidentId);
  }
  const updated = await updateDraftRecord(
    dependencies.prisma,
    organizationId,
    draftId,
    input,
  );
  if (!updated) {
    throw new ApplicationError(
      404,
      "DRAFT_NOT_FOUND",
      "The draft was not found or is no longer editable.",
    );
  }
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
  if (!draft) {
    throw new ApplicationError(404, "DRAFT_NOT_FOUND", "The draft was not found.");
  }
  return toDraftDto(draft);
}

export async function discardDraft(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  draftId: string,
): Promise<void> {
  if (!(await discardDraftRecord(dependencies.prisma, organizationId, draftId))) {
    throw new ApplicationError(
      404,
      "DRAFT_NOT_FOUND",
      "The draft was not found or is no longer editable.",
    );
  }
}

export async function createSession(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  cleanupEventId: string,
  input: ValidatedCreateSession,
) {
  await requireDraft(dependencies, organizationId, cleanupEventId);
  try {
    return await createEventSessionRecord(
      dependencies.prisma,
      cleanupEventId,
      input,
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ApplicationError(
        409,
        "SESSION_DUPLICATE",
        "A session already exists for this date and start time.",
      );
    }
    throw error;
  }
}

export async function updateSession(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  eventId: string,
  sessionId: string,
  input: ValidatedCreateSession,
) {
  try {
    const updated = await updateEventSessionRecord(
      dependencies.prisma,
      organizationId,
      eventId,
      sessionId,
      input,
    );
    if (!updated) {
      throw new ApplicationError(
        404,
        "SESSION_NOT_FOUND",
        "The session was not found in this draft.",
      );
    }
    return updated;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ApplicationError(
        409,
        "SESSION_DUPLICATE",
        "A session already exists for this date and start time.",
      );
    }
    throw error;
  }
}

export async function removeSession(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  eventId: string,
  sessionId: string,
): Promise<void> {
  const removed = await removeEventSessionRecord(
    dependencies.prisma,
    organizationId,
    eventId,
    sessionId,
  );
  if (!removed) {
    throw new ApplicationError(
      404,
      "SESSION_NOT_FOUND",
      "The session was not found in this draft.",
    );
  }
}

export async function assignCoordinator(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  cleanupEventId: string,
  membershipId: string,
  assignedByMembershipId: string,
) {
  await requireDraft(dependencies, organizationId, cleanupEventId);
  const membership = await findActiveOrganizationMembership(
    dependencies.prisma,
    organizationId,
    membershipId,
  );
  if (!membership) {
    throw new ApplicationError(
      400,
      "MEMBERSHIP_INVALID",
      "The coordinator must be an active member of this organization.",
    );
  }
  return assignCoordinatorRecord(
    dependencies.prisma,
    cleanupEventId,
    membershipId,
    assignedByMembershipId,
  );
}

export async function removeCoordinator(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  cleanupEventId: string,
  membershipId: string,
): Promise<void> {
  await requireDraft(dependencies, organizationId, cleanupEventId);
  const removed = await removeCoordinatorRecord(
    dependencies.prisma,
    cleanupEventId,
    membershipId,
  );
  if (!removed) {
    throw new ApplicationError(
      404,
      "COORDINATOR_NOT_FOUND",
      "The active coordinator assignment was not found in this draft.",
    );
  }
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
  const event = await findPublicCleanupEventById(dependencies.prisma, result.eventId);
  if (!event) {
    throw new ApplicationError(500, "PUBLISHED_EVENT_NOT_FOUND", "The published cleanup event could not be loaded.");
  }
  return { event: toPublicDetail(event), incidentUpdated: result.incidentUpdated };
}

export async function listPublicCleanupEvents(
  dependencies: CleanupEventDependencies,
  query: ValidatedCleanupEventListQuery,
): Promise<CleanupEventPublicPageDto> {
  const cursor = query.cursor
    ? decodeDatedCursor(query.cursor, "publishedAt") as CleanupEventPublicCursor
    : null;
  const records = await listPublicCleanupEventRecords(dependencies.prisma, {
    cursor,
    limit: query.limit,
  });
  const hasMore = records.length > query.limit;
  const page = hasMore ? records.slice(0, query.limit) : records;
  const last = page.at(-1);
  return {
    items: page.map(toPublicSummary),
    nextCursor: hasMore && last?.publishedAt
      ? encodeDatedCursor("publishedAt", last.publishedAt, last.id)
      : null,
  };
}

export async function getPublicCleanupEvent(
  dependencies: CleanupEventDependencies,
  eventId: string,
): Promise<CleanupEventPublicDetailDto> {
  const record = await findPublicCleanupEventById(dependencies.prisma, eventId);
  if (!record) {
    throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The public cleanup event was not found.");
  }
  return toPublicDetail(record);
}

export async function listOwnedCleanupEvents(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  query: ValidatedCleanupEventListQuery,
): Promise<CleanupEventOwnedPageDto> {
  const cursor = query.cursor
    ? decodeDatedCursor(query.cursor, "updatedAt") as CleanupEventOwnedCursor
    : null;
  const records = await listOwnedCleanupEventRecords(dependencies.prisma, {
    organizationId,
    cursor,
    limit: query.limit,
  });
  const hasMore = records.length > query.limit;
  const page = hasMore ? records.slice(0, query.limit) : records;
  const last = page.at(-1);
  return {
    items: page.map((record) => ({
      id: record.id,
      organization: record.organization,
      incidentId: record.incidentId,
      title: record.title,
      description: record.description,
      lifecycleStatus: record.lifecycleStatus,
      eventLatitude: Number(record.eventLatitude),
      eventLongitude: Number(record.eventLongitude),
      eventAddress: record.eventAddress,
      publishedAt: record.publishedAt?.toISOString() ?? null,
      firstSessionAt: firstSessionAt(record),
      updatedAt: record.updatedAt.toISOString(),
    })),
    nextCursor: hasMore && last
      ? encodeDatedCursor("updatedAt", last.updatedAt, last.id)
      : null,
  };
}

export async function listPublicCleanupEventMap(
  dependencies: CleanupEventDependencies,
  query: ValidatedCleanupEventMapQuery,
): Promise<CleanupEventMapFeatureCollectionDto> {
  const records = await listPublicCleanupEventMapRecords(dependencies.prisma, query);
  const hasMore = records.length > query.limit;
  const page = hasMore ? records.slice(0, query.limit) : records;
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
        status: record.lifecycleStatus,
        occurredAt: record.publishedAt.toISOString(),
      },
    })),
    nextCursor: hasMore && page.at(-1) ? page.at(-1)!.id : null,
  };
}
