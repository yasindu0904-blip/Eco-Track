import { ApplicationError } from "../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";
import type {
  CleanupEventDraftDto,
  CleanupEventDraftPageDto,
  CleanupEventSessionDto,
} from "../cleanupEvent.types.js";
import type {
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
  isIncidentVisibleToOrganization,
  removeCoordinatorRecord,
  removeEventSessionRecord,
  updateDraftRecord,
  updateEventSessionRecord,
  type CleanupEventDraftCursor,
  type CleanupEventDraftRecord,
} from "../repositories/cleanupEvent.repository.js";

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
