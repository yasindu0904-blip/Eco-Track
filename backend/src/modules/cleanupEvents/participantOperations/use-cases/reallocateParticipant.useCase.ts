import { ApplicationError } from "../../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import {
  countActiveSessionAllocations,
  findAllocationOperationRecord,
  findParticipantOperationsEvent,
  findParticipantSessionAllocation,
} from "../participantOperations.repository.js";
import {
  notifyParticipantOperation,
  requireAvailableTargetSession,
  requireOperationalLifecycle,
  toAllocationDto,
} from "../participantOperations.support.js";
import type { ParticipantOperationAllocationDto } from "../participantOperations.types.js";
import type { ValidatedReallocateParticipant } from "../participantOperations.validation.js";

export async function reallocateParticipant(
  dependencies: CleanupEventDependencies,
  input: ValidatedReallocateParticipant & {
    organizationId: string;
    eventId: string;
    allocationId: string;
    actorMembershipId: string;
    actorUserId: string;
  },
): Promise<ParticipantOperationAllocationDto> {
  return dependencies.prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`event-session-capacity:${input.sessionId}`}))`;
    const event = await findParticipantOperationsEvent(transaction, input.organizationId, input.eventId);
    if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The organization cleanup event was not found.");
    requireOperationalLifecycle(event.lifecycleStatus);
    const allocation = await findAllocationOperationRecord(transaction, input.organizationId, input.eventId, input.allocationId);
    if (!allocation) throw new ApplicationError(404, "SESSION_ALLOCATION_NOT_FOUND", "The session allocation was not found.");
    if (allocation.status !== "PLANNED") {
      throw new ApplicationError(409, "ALLOCATION_NOT_REALLOCATABLE", "Only a planned allocation can be moved.");
    }
    if (allocation.sessionId === input.sessionId) return toAllocationDto(allocation);
    const session = event.sessions.find(({ id }) => id === input.sessionId);
    if (!session) throw new ApplicationError(404, "EVENT_SESSION_NOT_FOUND", "The target event session was not found.");
    requireAvailableTargetSession(allocation.participant, session, new Date());
    const allocatedCount = await countActiveSessionAllocations(transaction, session.id);
    if (session.capacity !== null && allocatedCount >= session.capacity) {
      throw new ApplicationError(409, "SESSION_CAPACITY_REACHED", "The target session has reached its volunteer capacity.");
    }
    const existingTarget = await findParticipantSessionAllocation(transaction, allocation.participantId, session.id);
    if (existingTarget && existingTarget.status !== "REMOVED") {
      throw new ApplicationError(409, "PARTICIPANT_ALREADY_ALLOCATED", "The volunteer already has an active allocation for the target session.");
    }
    const now = new Date();
    let saved;
    if (existingTarget) {
      await transaction.sessionAllocation.update({
        where: { id: allocation.id },
        data: {
          status: "REMOVED",
          attendanceMarkedByMembershipId: input.actorMembershipId,
          attendanceMarkedAt: now,
        },
      });
      saved = await transaction.sessionAllocation.update({
        where: { id: existingTarget.id },
        data: {
          status: "PLANNED",
          allocatedByMembershipId: input.actorMembershipId,
          allocatedAt: now,
          attendanceMarkedByMembershipId: null,
          attendanceMarkedAt: null,
          notes: allocation.notes,
        },
      });
    } else {
      saved = await transaction.sessionAllocation.update({
        where: { id: allocation.id },
        data: {
          sessionId: session.id,
          allocatedByMembershipId: input.actorMembershipId,
          allocatedAt: now,
        },
      });
    }
    await transaction.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: "EVENT_PARTICIPANT_REALLOCATED",
      entityType: "SessionAllocation",
      entityId: saved.id,
      metadata: { eventId: event.id, participantId: allocation.participantId, fromSessionId: allocation.sessionId, toSessionId: session.id },
    } });
    await notifyParticipantOperation(transaction, {
      userId: allocation.participant.userId,
      organizationId: input.organizationId,
      eventId: event.id,
      sessionId: session.id,
      title: "Cleanup session changed",
      message: `Your assigned session for ${event.title} changed.`,
      status: "PLANNED",
    });
    return toAllocationDto(saved);
  }, { timeout: 30_000 });
}

