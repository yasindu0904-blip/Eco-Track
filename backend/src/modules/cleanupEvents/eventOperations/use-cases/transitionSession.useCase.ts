import { ApplicationError } from "../../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import { findEventOperationsRecord } from "../eventOperations.repository.js";
import { assertMutableEvent, formatDate, formatTime, notifyActiveParticipants, requireSessionTransition } from "../eventOperations.support.js";
import type { EventOperationSessionDto } from "../eventOperations.types.js";
import type { ValidatedTransitionSession } from "../eventOperations.validation.js";

export async function transitionSession(
  dependencies: CleanupEventDependencies,
  input: ValidatedTransitionSession & {
    organizationId: string;
    eventId: string;
    sessionId: string;
    actorUserId: string;
  },
): Promise<EventOperationSessionDto> {
  return dependencies.prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`event-session:${input.sessionId}`}))`;
    const event = await findEventOperationsRecord(transaction, input.organizationId, input.eventId);
    if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The organization cleanup event was not found.");
    assertMutableEvent(event.lifecycleStatus);
    const session = event.sessions.find(({ id }) => id === input.sessionId);
    if (!session) throw new ApplicationError(404, "EVENT_SESSION_NOT_FOUND", "The event session was not found.");
    requireSessionTransition(session.status, input.status);
    const changed = await transaction.eventSession.updateMany({
      where: { id: session.id, cleanupEventId: event.id, status: session.status, updatedAt: new Date(input.expectedUpdatedAt) },
      data: { status: input.status },
    });
    if (changed.count !== 1) throw new ApplicationError(409, "SESSION_STATE_CONFLICT", "The session changed in another request. Refresh and retry.");
    const saved = await transaction.eventSession.findUniqueOrThrow({ where: { id: session.id } });
    await transaction.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: "EVENT_SESSION_STATUS_CHANGED",
      entityType: "EventSession",
      entityId: session.id,
      metadata: { eventId: event.id, fromStatus: session.status, toStatus: input.status, reason: input.reason ?? null },
    } });
    await notifyActiveParticipants(transaction, {
      eventId: event.id,
      organizationId: input.organizationId,
      type: "EVENT_UPDATED",
      title: "Cleanup session updated",
      message: `A session for ${event.title} is now ${input.status.toLowerCase().replaceAll("_", " ")}.`,
      extraData: { sessionId: session.id },
    });
    return {
      id: saved.id,
      sessionDate: formatDate(saved.sessionDate),
      startTime: formatTime(saved.startTime),
      endTime: formatTime(saved.endTime),
      status: saved.status,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }, { timeout: 30_000 });
}
