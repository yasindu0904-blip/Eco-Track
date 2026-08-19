import { NotificationType } from "../../../../generated/prisma/client.js";
import { ApplicationError } from "../../../../errors/applicationError.js";
import { createNotificationRecord } from "../../../notifications/repositories/notification.repository.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import type { EventParticipationDto } from "../../cleanupEvent.types.js";
import { findParticipation, findParticipationEvent } from "../participation.repository.js";
import { notifyParticipationOperations, toParticipationDto } from "../participation.support.js";

export async function withdrawFromEvent(
  dependencies: CleanupEventDependencies,
  eventId: string,
  userId: string,
): Promise<EventParticipationDto> {
  return dependencies.prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`event-participation:${eventId}:${userId}`}))`;
    const event = await findParticipationEvent(transaction, eventId);
    if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The cleanup event was not found.");
    const existing = await findParticipation(transaction, eventId, userId);
    if (!existing) throw new ApplicationError(404, "PARTICIPATION_NOT_FOUND", "You have not joined this event.");
    if (existing.status === "REMOVED") throw new ApplicationError(409, "PARTICIPANT_REMOVED", "This participation was removed by the event team.");
    if (existing.status === "WITHDRAWN") return toParticipationDto(existing);
    if (!["PUBLISHED", "SCHEDULED", "IN_PROGRESS"].includes(event.lifecycleStatus)) throw new ApplicationError(409, "EVENT_WITHDRAWAL_CLOSED", "Withdrawal is closed for this event.");
    await transaction.eventParticipant.update({ where: { id: existing.id }, data: { status: "WITHDRAWN", withdrawnAt: new Date() } });
    await transaction.auditLog.create({ data: { actorUserId: userId, organizationId: event.organizationId, action: "EVENT_PARTICIPANT_WITHDRAWN", entityType: "EventParticipant", entityId: existing.id, metadata: { eventId } } });
    await createNotificationRecord(transaction, { userId, organizationId: event.organizationId, type: NotificationType.EVENT_UPDATED, title: "You left a cleanup event", message: `Your participation in ${event.title} was withdrawn.`, data: { eventId, organizationId: event.organizationId, status: "WITHDRAWN" } });
    await notifyParticipationOperations(transaction, event, userId, "withdrew");
    const saved = await findParticipation(transaction, eventId, userId);
    if (!saved) throw new ApplicationError(500, "PARTICIPATION_SAVE_FAILED", "The participation could not be loaded.");
    return toParticipationDto(saved);
  });
}
