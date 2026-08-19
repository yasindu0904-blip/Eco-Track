import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";
import { ApplicationError } from "../../../errors/applicationError.js";
import {
  createDraftRecord,
  findOwnDrafts,
  findOwnDraftById,
  updateDraftRecord,
  createEventSessionRecord,
  removeEventSessionRecord,
  findEventById,
  assignCoordinatorRecord,
  removeCoordinatorRecord,
  findDraftWorkflowStatusId,
  isIncidentVisibleToOrganization,
  updateEventSessionRecord,
} from "../repositories/cleanupEvent.repository.js";

export async function createDraft(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  membershipId: string,
  input: any,
) {
  const workflowStatusId = await findDraftWorkflowStatusId(dependencies.prisma, organizationId);
  if (!workflowStatusId) {
    throw new ApplicationError(409, "DRAFT_WORKFLOW_UNAVAILABLE", "This organization does not have an active draft workflow status.");
  }
  // If incidentId provided, do a minimal visibility check: only allow if an organization review exists
  if (input.incidentId) {
    if (!(await isIncidentVisibleToOrganization(dependencies.prisma, organizationId, input.incidentId))) {
      throw new ApplicationError(400, "INCIDENT_NOT_VISIBLE", "The specified incident is not visible to this organization.");
    }
  }

  return createDraftRecord(dependencies.prisma, organizationId, membershipId, input);
}

export async function updateSession(dependencies: CleanupEventDependencies, organizationId: string, eventId: string, sessionId: string, input: any) {
  if (input.endTime <= input.startTime) throw new ApplicationError(400, "SESSION_INVALID_TIME", "Session end time must be after start time.");
  try {
    const updated = await updateEventSessionRecord(dependencies.prisma, organizationId, eventId, sessionId, input);
    if (!updated) throw new ApplicationError(404, "SESSION_NOT_FOUND", "Session not found in this draft.");
    return updated;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") throw new ApplicationError(409, "SESSION_DUPLICATE", "A session already exists for this date and start time.");
    throw error;
  }
}

export async function updateDraft(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  membershipId: string,
  draftId: string,
  input: any,
) {
  const updated = await updateDraftRecord(dependencies.prisma, organizationId, draftId, membershipId, input);
  if (!updated) throw new ApplicationError(404, "DRAFT_NOT_FOUND", "Draft not found or not editable.");
  return updated;
}

export async function listMyDrafts(dependencies: CleanupEventDependencies, organizationId: string, membershipId: string) {
  return findOwnDrafts(dependencies.prisma, organizationId, membershipId);
}

export async function getMyDraft(dependencies: CleanupEventDependencies, organizationId: string, membershipId: string, id: string) {
  const draft = await findOwnDraftById(dependencies.prisma, organizationId, membershipId, id);
  if (!draft) throw new ApplicationError(404, "DRAFT_NOT_FOUND", "Draft not found.");
  return draft;
}

export async function createSession(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  cleanupEventId: string,
  input: any,
) {
  const event = await findEventById(dependencies.prisma, organizationId, cleanupEventId);
  if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The cleanup event was not found in this organization.");

  // validations: end after start
  if (input.endTime <= input.startTime) {
    throw new ApplicationError(400, "SESSION_INVALID_TIME", "Session end time must be after start time.");
  }

  // capacity positive is validated by Zod earlier

  // unique date/start is enforced by DB unique constraint; attempt create and let DB error bubble up as 400
  try {
    return await createEventSessionRecord(dependencies.prisma, cleanupEventId, input);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new ApplicationError(409, "SESSION_DUPLICATE", "A session already exists for this date and start time.");
    }
    throw error;
  }
}

export async function removeSession(dependencies: CleanupEventDependencies, organizationId: string, eventId: string, sessionId: string) {
  const session = await dependencies.prisma.eventSession.findFirst({ where: { id: sessionId, cleanupEventId: eventId }, select: { cleanupEvent: { select: { organizationId: true, lifecycleStatus: true } } } });
  if (!session || session.cleanupEvent.organizationId !== organizationId || session.cleanupEvent.lifecycleStatus !== "DRAFT") throw new ApplicationError(404, "SESSION_NOT_FOUND", "Session not found in this draft.");
  await removeEventSessionRecord(dependencies.prisma, sessionId);
}

export async function assignCoordinator(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  cleanupEventId: string,
  membershipId: string,
  assignedByMembershipId: string,
) {
  // ensure membership exists and is active and belongs to organization
  const membership = await dependencies.prisma.organizationMembership.findFirst({ where: { id: membershipId, organizationId, status: "ACTIVE" } });
  if (!membership) throw new ApplicationError(400, "MEMBERSHIP_INVALID", "Coordinator membership must be active and belong to organization.");

  // ensure event exists and belongs to organization
  const event = await findEventById(dependencies.prisma, organizationId, cleanupEventId);
  if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The cleanup event was not found in this organization.");

  return assignCoordinatorRecord(dependencies.prisma, cleanupEventId, membershipId, assignedByMembershipId);
}

export async function removeCoordinator(dependencies: CleanupEventDependencies, organizationId: string, cleanupEventId: string, membershipId: string) {
  const event = await findEventById(dependencies.prisma, organizationId, cleanupEventId);
  if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The cleanup event was not found in this organization.");
  return removeCoordinatorRecord(dependencies.prisma, cleanupEventId, membershipId);
}
