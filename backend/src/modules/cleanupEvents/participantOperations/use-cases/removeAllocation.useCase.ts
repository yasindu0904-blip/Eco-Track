import { ApplicationError } from "../../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import { findAllocationOperationRecord, findParticipantOperationsEvent } from "../participantOperations.repository.js";
import {
  notifyParticipantOperation,
  requireParticipantFinalizationLifecycle,
  toAllocationDto,
} from "../participantOperations.support.js";
import type { ParticipantOperationAllocationDto } from "../participantOperations.types.js";

export async function removeAllocation(
  dependencies: CleanupEventDependencies,
  input: {
    organizationId: string;
    eventId: string;
    allocationId: string;
    actorMembershipId: string;
    actorUserId: string;
  },
): Promise<ParticipantOperationAllocationDto> {
  return dependencies.prisma.$transaction(async (transaction) => {
    const event = await findParticipantOperationsEvent(transaction, input.organizationId, input.eventId);
    if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The organization cleanup event was not found.");
    requireParticipantFinalizationLifecycle(event.lifecycleStatus);
    const allocation = await findAllocationOperationRecord(transaction, input.organizationId, input.eventId, input.allocationId);
    if (!allocation) throw new ApplicationError(404, "SESSION_ALLOCATION_NOT_FOUND", "The session allocation was not found.");
    if (allocation.status === "REMOVED") return toAllocationDto(allocation);
    if (allocation.status !== "PLANNED") {
      throw new ApplicationError(409, "ALLOCATION_REMOVAL_CLOSED", "Attendance history cannot be removed from a session allocation.");
    }
    const now = new Date();
    const saved = await transaction.sessionAllocation.update({
      where: { id: allocation.id },
      data: {
        status: "REMOVED",
        attendanceMarkedByMembershipId: input.actorMembershipId,
        attendanceMarkedAt: now,
      },
    });
    await transaction.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: "EVENT_SESSION_ALLOCATION_REMOVED",
      entityType: "SessionAllocation",
      entityId: saved.id,
      metadata: { eventId: event.id, participantId: allocation.participantId, sessionId: allocation.sessionId },
    } });
    await notifyParticipantOperation(transaction, {
      userId: allocation.participant.userId,
      organizationId: input.organizationId,
      eventId: event.id,
      sessionId: allocation.sessionId,
      title: "Cleanup session assignment removed",
      message: `A session assignment for ${event.title} was removed.`,
      status: "REMOVED",
    });
    return toAllocationDto(saved);
  });
}

