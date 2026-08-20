import { ApplicationError } from "../../../../errors/applicationError.js";
import { NotificationType } from "../../../../generated/prisma/enums.js";
import { createNotification } from "../../../notifications/services/createNotification.service.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import { findEventOperationsRecord } from "../eventOperations.repository.js";
import { notifyActiveParticipants } from "../eventOperations.support.js";
import type { EventLifecycleMutationDto } from "../eventOperations.types.js";
import type { ValidatedCancelEvent } from "../eventOperations.validation.js";

function releasedIncidentStatus(now: Date, incident: { highlightUntil: Date; archiveAfter: Date }) {
  if (now <= incident.highlightUntil) return "ACTIVE" as const;
  if (now <= incident.archiveAfter) return "EXPIRED" as const;
  return "ARCHIVED" as const;
}

export async function cancelCleanupEvent(
  dependencies: CleanupEventDependencies,
  input: ValidatedCancelEvent & {
    organizationId: string;
    eventId: string;
    actorMembershipId: string;
    actorUserId: string;
  },
): Promise<EventLifecycleMutationDto> {
  return dependencies.prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cleanup-event:${input.eventId}`}))`;
    const event = await findEventOperationsRecord(transaction, input.organizationId, input.eventId);
    if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The organization cleanup event was not found.");
    if (event.lifecycleStatus === "CANCELLED") {
      return { eventId: event.id, lifecycleStatus: "CANCELLED", updatedAt: event.updatedAt.toISOString(), incidentStatus: event.incident?.status ?? null, rewardsAwarded: 0, idempotentReplay: true };
    }
    if (event.lifecycleStatus === "COMPLETED") throw new ApplicationError(409, "EVENT_TERMINAL", "A completed event cannot be cancelled.");
    const transition = event.currentWorkflowStatus.outgoingTransitions.find(({ toStatus }) => toStatus.mappedLifecycleStatus === "CANCELLED");
    if (!transition) throw new ApplicationError(409, "EVENT_CANCELLATION_NOT_CONFIGURED", "The current workflow status cannot be cancelled.");
    const now = new Date();
    const changed = await transaction.cleanupEvent.updateMany({
      where: {
        id: event.id,
        organizationId: input.organizationId,
        currentWorkflowStatusId: event.currentWorkflowStatusId,
        lifecycleStatus: event.lifecycleStatus,
        updatedAt: new Date(input.expectedUpdatedAt),
      },
      data: {
        currentWorkflowStatusId: transition.toStatus.id,
        lifecycleStatus: "CANCELLED",
        cancelledAt: now,
        cancellationReason: input.reason,
      },
    });
    if (changed.count !== 1) throw new ApplicationError(409, "EVENT_STATE_CONFLICT", "The event changed in another request. Refresh and retry.");
    await transaction.eventSession.updateMany({
      where: { cleanupEventId: event.id, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
      data: { status: "CANCELLED" },
    });
    await transaction.eventStatusHistory.create({ data: {
      cleanupEventId: event.id,
      fromWorkflowStatusId: event.currentWorkflowStatusId,
      toWorkflowStatusId: transition.toStatus.id,
      changedByMembershipId: input.actorMembershipId,
      notes: input.reason,
      changedAt: now,
    } });
    let incidentStatus = event.incident?.status ?? null;
    if (event.incident && event.incident.status === "CLEANUP_ORGANIZED") {
      const nextStatus = releasedIncidentStatus(now, event.incident);
      const incidentChanged = await transaction.incident.updateMany({
        where: { id: event.incident.id, status: "CLEANUP_ORGANIZED" },
        data: {
          status: nextStatus,
          resolvedAt: null,
          ...(nextStatus === "ARCHIVED" ? { archivedAt: now } : { archivedAt: null }),
        },
      });
      if (incidentChanged.count !== 1) throw new ApplicationError(409, "INCIDENT_STATE_CONFLICT", "The linked incident changed in another request. Refresh and retry.");
      await transaction.incidentStatusHistory.create({ data: {
        incidentId: event.incident.id,
        fromStatus: "CLEANUP_ORGANIZED",
        toStatus: nextStatus,
        changedByUserId: input.actorUserId,
        relatedCleanupEventId: event.id,
        reason: `Cleanup event cancelled: ${input.reason}`,
        changedAt: now,
      } });
      incidentStatus = nextStatus;
      await createNotification({ prisma: transaction }, {
        userId: event.incident.reporterUserId,
        organizationId: input.organizationId,
        type: NotificationType.INCIDENT_STATUS_CHANGED,
        title: "Cleanup event cancelled",
        message: `The cleanup event for your report was cancelled. The incident is now ${nextStatus.toLowerCase()}.`,
        data: { eventId: event.id, incidentId: event.incident.id, organizationId: input.organizationId },
      });
    }
    await transaction.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: "CLEANUP_EVENT_CANCELLED",
      entityType: "CleanupEvent",
      entityId: event.id,
      metadata: { reason: input.reason, incidentStatus },
    } });
    await notifyActiveParticipants(transaction, {
      eventId: event.id,
      organizationId: input.organizationId,
      type: "EVENT_CANCELLED",
      title: "Cleanup event cancelled",
      message: `${event.title} was cancelled. Open EcoTrack for the recorded reason.`,
    });
    const saved = await transaction.cleanupEvent.findUniqueOrThrow({ where: { id: event.id }, select: { updatedAt: true } });
    return { eventId: event.id, lifecycleStatus: "CANCELLED", updatedAt: saved.updatedAt.toISOString(), incidentStatus, rewardsAwarded: 0, idempotentReplay: false };
  }, { timeout: 30_000 });
}
