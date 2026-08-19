import { ApplicationError } from "../../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import type { EventParticipationDto } from "../../cleanupEvent.types.js";
import { findParticipation, findParticipationEvent } from "../participation.repository.js";
import { toParticipationDto, validateSelectedSessions } from "../participation.support.js";

export async function updateAvailability(
  dependencies: CleanupEventDependencies,
  eventId: string,
  userId: string,
  sessionIds: string[],
): Promise<EventParticipationDto> {
  return dependencies.prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`event-participation:${eventId}:${userId}`}))`;
    const event = await findParticipationEvent(transaction, eventId);
    if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The cleanup event was not found.");
    if (!["PUBLISHED", "SCHEDULED", "IN_PROGRESS"].includes(event.lifecycleStatus)) throw new ApplicationError(409, "EVENT_AVAILABILITY_CLOSED", "Availability can no longer be changed for this event.");
    validateSelectedSessions(event, sessionIds, new Date());
    const participant = await findParticipation(transaction, eventId, userId);
    if (!participant) throw new ApplicationError(404, "PARTICIPATION_NOT_FOUND", "You have not joined this event.");
    if (participant.status !== "JOINED") throw new ApplicationError(409, "PARTICIPATION_NOT_ACTIVE", "Only an active participant can change availability.");
    await transaction.participantSessionAvailability.deleteMany({ where: { participantId: participant.id } });
    await transaction.participantSessionAvailability.createMany({ data: sessionIds.map((sessionId) => ({ participantId: participant.id, sessionId })) });
    await transaction.auditLog.create({ data: { actorUserId: userId, organizationId: event.organizationId, action: "EVENT_PARTICIPANT_AVAILABILITY_UPDATED", entityType: "EventParticipant", entityId: participant.id, metadata: { eventId, sessionIds } } });
    const saved = await findParticipation(transaction, eventId, userId);
    if (!saved) throw new ApplicationError(500, "PARTICIPATION_SAVE_FAILED", "The participation could not be loaded.");
    return toParticipationDto(saved);
  });
}
