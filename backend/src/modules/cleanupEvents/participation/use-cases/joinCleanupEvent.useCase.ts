import { NotificationType } from "../../../../generated/prisma/client.js";
import { ApplicationError } from "../../../../errors/applicationError.js";
import { createNotificationRecord } from "../../../notifications/repositories/notification.repository.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import type { JoinEventResultDto } from "../../cleanupEvent.types.js";
import { findParticipation, findParticipationEvent } from "../participation.repository.js";
import { notifyParticipationOperations, requireJoinableEvent, toParticipationDto, validateSelectedSessions } from "../participation.support.js";

export async function joinEvent(
  dependencies: CleanupEventDependencies,
  eventId: string,
  userId: string,
  sessionIds: string[],
): Promise<JoinEventResultDto> {
  return dependencies.prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`event-participation:${eventId}:${userId}`}))`;
    const event = await findParticipationEvent(transaction, eventId);
    if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The cleanup event was not found.");
    const existing = await findParticipation(transaction, eventId, userId);
    if (existing?.status === "REMOVED") throw new ApplicationError(409, "PARTICIPANT_REMOVED", "You cannot rejoin this event after being removed.");
    if (existing?.status === "JOINED") return { participation: toParticipationDto(existing), created: false, rejoined: false };
    requireJoinableEvent(event.lifecycleStatus);
    validateSelectedSessions(event, sessionIds, new Date());
    const now = new Date();
    const participant = existing
      ? await transaction.eventParticipant.update({ where: { id: existing.id }, data: { status: "JOINED", joinedAt: now, withdrawnAt: null } })
      : await transaction.eventParticipant.create({ data: { cleanupEventId: eventId, userId, status: "JOINED", joinedAt: now } });
    await transaction.participantSessionAvailability.deleteMany({ where: { participantId: participant.id } });
    await transaction.participantSessionAvailability.createMany({ data: sessionIds.map((sessionId) => ({ participantId: participant.id, sessionId })) });
    await transaction.auditLog.create({ data: { actorUserId: userId, organizationId: event.organizationId, action: existing ? "EVENT_PARTICIPANT_REJOINED" : "EVENT_PARTICIPANT_JOINED", entityType: "EventParticipant", entityId: participant.id, metadata: { eventId, sessionIds } } });
    await createNotificationRecord(transaction, { userId, organizationId: event.organizationId, type: NotificationType.EVENT_JOINED, title: existing ? "You rejoined a cleanup" : "You joined a cleanup", message: `Your availability for ${event.title} was saved.`, data: { eventId, organizationId: event.organizationId, status: "JOINED" } });
    await notifyParticipationOperations(transaction, event, userId, "joined");
    const saved = await findParticipation(transaction, eventId, userId);
    if (!saved) throw new ApplicationError(500, "PARTICIPATION_SAVE_FAILED", "The participation could not be loaded.");
    return { participation: toParticipationDto(saved), created: !existing, rejoined: Boolean(existing) };
  }, { timeout: 30_000 });
}
