import { ApplicationError } from "../../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import {
  countActiveSessionAllocations,
  findParticipantOperationRecord,
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
import type { ValidatedAllocateParticipant } from "../participantOperations.validation.js";

export async function allocateParticipant(
  dependencies: CleanupEventDependencies,
  input: ValidatedAllocateParticipant & {
    organizationId: string;
    eventId: string;
    actorMembershipId: string;
    actorUserId: string;
  },
): Promise<ParticipantOperationAllocationDto> {
  return dependencies.prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`event-session-capacity:${input.sessionId}`}))`;
    const event = await findParticipantOperationsEvent(transaction, input.organizationId, input.eventId);
    if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The organization cleanup event was not found.");
    requireOperationalLifecycle(event.lifecycleStatus);
    const participant = await findParticipantOperationRecord(transaction, input.organizationId, input.eventId, input.participantId);
    if (!participant) throw new ApplicationError(404, "EVENT_PARTICIPANT_NOT_FOUND", "The event participant was not found.");
    const session = event.sessions.find(({ id }) => id === input.sessionId);
    if (!session) throw new ApplicationError(404, "EVENT_SESSION_NOT_FOUND", "The event session was not found.");
    requireAvailableTargetSession(participant, session, new Date());
    const existing = await findParticipantSessionAllocation(transaction, participant.id, session.id);
    if (existing && existing.status !== "REMOVED") return toAllocationDto(existing);
    const allocatedCount = await countActiveSessionAllocations(transaction, session.id);
    if (session.capacity !== null && allocatedCount >= session.capacity) {
      throw new ApplicationError(409, "SESSION_CAPACITY_REACHED", "The target session has reached its volunteer capacity.");
    }
    const now = new Date();
    const saved = existing
      ? await transaction.sessionAllocation.update({
          where: { id: existing.id },
          data: {
            status: "PLANNED",
            allocatedByMembershipId: input.actorMembershipId,
            allocatedAt: now,
            attendanceMarkedByMembershipId: null,
            attendanceMarkedAt: null,
            notes: input.notes === undefined ? existing.notes : input.notes,
          },
        })
      : await transaction.sessionAllocation.create({
          data: {
            participantId: participant.id,
            sessionId: session.id,
            allocatedByMembershipId: input.actorMembershipId,
            notes: input.notes ?? null,
          },
        });
    await transaction.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: existing ? "EVENT_PARTICIPANT_REALLOCATED_TO_SESSION" : "EVENT_PARTICIPANT_ALLOCATED_TO_SESSION",
      entityType: "SessionAllocation",
      entityId: saved.id,
      metadata: { eventId: event.id, participantId: participant.id, sessionId: session.id },
    } });
    await notifyParticipantOperation(transaction, {
      userId: participant.userId,
      organizationId: input.organizationId,
      eventId: event.id,
      sessionId: session.id,
      title: "Cleanup session assigned",
      message: `You were assigned to a session for ${event.title}.`,
      status: "PLANNED",
    });
    return toAllocationDto(saved);
  }, { timeout: 30_000 });
}
