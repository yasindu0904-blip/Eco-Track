import { ApplicationError } from "../../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import { findParticipantOperationRecord, findParticipantOperationsEvent } from "../participantOperations.repository.js";
import { notifyParticipantOperation, requireOperationalLifecycle, toParticipantOperationDto } from "../participantOperations.support.js";
import type { ParticipantRemovalResultDto } from "../participantOperations.types.js";
import type { ValidatedRemoveParticipant } from "../participantOperations.validation.js";

export async function removeParticipant(
  dependencies: CleanupEventDependencies,
  input: ValidatedRemoveParticipant & {
    organizationId: string;
    eventId: string;
    participantId: string;
    actorMembershipId: string;
    actorUserId: string;
  },
): Promise<ParticipantRemovalResultDto> {
  return dependencies.prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`event-participant-remove:${input.participantId}`}))`;
    const event = await findParticipantOperationsEvent(transaction, input.organizationId, input.eventId);
    if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The organization cleanup event was not found.");
    requireOperationalLifecycle(event.lifecycleStatus);
    const participant = await findParticipantOperationRecord(transaction, input.organizationId, input.eventId, input.participantId);
    if (!participant) throw new ApplicationError(404, "EVENT_PARTICIPANT_NOT_FOUND", "The event participant was not found.");
    if (participant.status === "REMOVED") return { participant: toParticipantOperationDto(participant), removedAllocationCount: 0 };
    if (participant.status !== "JOINED") {
      throw new ApplicationError(409, "PARTICIPANT_NOT_ACTIVE", "Only a joined volunteer can be removed from the event.");
    }
    const now = new Date();
    const removedAllocations = await transaction.sessionAllocation.updateMany({
      where: { participantId: participant.id, status: "PLANNED" },
      data: {
        status: "REMOVED",
        attendanceMarkedByMembershipId: input.actorMembershipId,
        attendanceMarkedAt: now,
      },
    });
    await transaction.eventParticipant.update({
      where: { id: participant.id },
      data: {
        status: "REMOVED",
        removedAt: now,
        removedByMembershipId: input.actorMembershipId,
        removalReason: input.reason,
      },
    });
    await transaction.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: "EVENT_PARTICIPANT_REMOVED",
      entityType: "EventParticipant",
      entityId: participant.id,
      metadata: { eventId: event.id, removedAllocationCount: removedAllocations.count, reason: input.reason },
    } });
    await notifyParticipantOperation(transaction, {
      userId: participant.userId,
      organizationId: input.organizationId,
      eventId: event.id,
      title: "Cleanup participation removed",
      message: `Your participation in ${event.title} was removed by the event team.`,
      status: "REMOVED",
    });
    const saved = await findParticipantOperationRecord(transaction, input.organizationId, input.eventId, participant.id);
    if (!saved) throw new ApplicationError(500, "PARTICIPANT_SAVE_FAILED", "The removed participant could not be loaded.");
    return { participant: toParticipantOperationDto(saved), removedAllocationCount: removedAllocations.count };
  }, { timeout: 30_000 });
}

