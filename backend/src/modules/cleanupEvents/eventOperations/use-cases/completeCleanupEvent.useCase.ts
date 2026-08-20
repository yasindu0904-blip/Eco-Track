import { ApplicationError } from "../../../../errors/applicationError.js";
import { NotificationType } from "../../../../generated/prisma/enums.js";
import { createNotification } from "../../../notifications/services/createNotification.service.js";
import { awardCompletedEventContribution } from "../../../rewards/services/awardContribution.service.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import { findEventOperationsRecord } from "../eventOperations.repository.js";
import { getCompletionReadinessFromRecord } from "../eventOperations.service.js";
import type { EventLifecycleMutationDto } from "../eventOperations.types.js";
import type { ValidatedCompleteEvent } from "../eventOperations.validation.js";

export async function completeCleanupEvent(
  dependencies: CleanupEventDependencies,
  input: ValidatedCompleteEvent & {
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
    if (event.lifecycleStatus === "COMPLETED") {
      return { eventId: event.id, lifecycleStatus: "COMPLETED", updatedAt: event.updatedAt.toISOString(), incidentStatus: event.incident?.status ?? null, rewardsAwarded: 0, idempotentReplay: true };
    }
    if (event.lifecycleStatus === "CANCELLED") throw new ApplicationError(409, "EVENT_TERMINAL", "A cancelled event cannot be completed.");
    const readiness = getCompletionReadinessFromRecord(event);
    if (!readiness.ready) {
      throw new ApplicationError(409, "EVENT_COMPLETION_NOT_READY", readiness.checks.filter(({ ready }) => !ready).map(({ message }) => message).join(" "));
    }
    const transition = event.currentWorkflowStatus.outgoingTransitions.find(({ toStatus }) => toStatus.mappedLifecycleStatus === "COMPLETED")!;
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
        lifecycleStatus: "COMPLETED",
        completedAt: now,
      },
    });
    if (changed.count !== 1) throw new ApplicationError(409, "EVENT_STATE_CONFLICT", "The event changed in another request. Refresh and retry.");
    await transaction.eventStatusHistory.create({ data: {
      cleanupEventId: event.id,
      fromWorkflowStatusId: event.currentWorkflowStatusId,
      toWorkflowStatusId: transition.toStatus.id,
      changedByMembershipId: input.actorMembershipId,
      notes: input.notes ?? null,
      changedAt: now,
    } });
    let incidentStatus = event.incident?.status ?? null;
    if (event.incident) {
      const incidentChanged = await transaction.incident.updateMany({
        where: { id: event.incident.id, status: "CLEANUP_ORGANIZED" },
        data: { status: "RESOLVED", resolvedAt: now },
      });
      if (incidentChanged.count !== 1) throw new ApplicationError(409, "INCIDENT_STATE_CONFLICT", "The linked incident is no longer awaiting this cleanup event.");
      await transaction.incidentStatusHistory.create({ data: {
        incidentId: event.incident.id,
        fromStatus: "CLEANUP_ORGANIZED",
        toStatus: "RESOLVED",
        changedByUserId: input.actorUserId,
        relatedCleanupEventId: event.id,
        reason: "The linked cleanup event was completed with recorded attendance and evidence.",
        changedAt: now,
      } });
      incidentStatus = "RESOLVED";
      await createNotification({ prisma: transaction }, {
        userId: event.incident.reporterUserId,
        organizationId: input.organizationId,
        type: NotificationType.INCIDENT_STATUS_CHANGED,
        title: "Your environmental report was resolved",
        message: `The cleanup event ${event.title} was completed.`,
        data: { eventId: event.id, incidentId: event.incident.id, organizationId: input.organizationId },
      });
    }
    let rewardsAwarded = 0;
    for (const participant of event.participants) {
      if (participant.allocations.some(({ status }) => status === "ATTENDED")) {
        const reward = await awardCompletedEventContribution(transaction, { cleanupEventId: event.id, participantId: participant.id });
        if (reward.created) rewardsAwarded += 1;
      }
      if (participant.status !== "REMOVED") {
        await createNotification({ prisma: transaction }, {
          userId: participant.userId,
          organizationId: input.organizationId,
          type: NotificationType.EVENT_COMPLETED,
          title: "Cleanup event completed",
          message: `${event.title} has been completed. Thank you for supporting your community.`,
          data: { eventId: event.id, organizationId: input.organizationId },
        });
      }
    }
    await transaction.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: "CLEANUP_EVENT_COMPLETED",
      entityType: "CleanupEvent",
      entityId: event.id,
      metadata: { incidentStatus, rewardsAwarded },
    } });
    const saved = await transaction.cleanupEvent.findUniqueOrThrow({ where: { id: event.id }, select: { updatedAt: true } });
    return { eventId: event.id, lifecycleStatus: "COMPLETED", updatedAt: saved.updatedAt.toISOString(), incidentStatus, rewardsAwarded, idempotentReplay: false };
  }, { timeout: 30_000 });
}
