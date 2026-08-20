import { ApplicationError } from "../../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import { findEventOperationsRecord } from "../eventOperations.repository.js";
import { assertMutableEvent, notifyActiveParticipants } from "../eventOperations.support.js";
import type { EventLifecycleMutationDto } from "../eventOperations.types.js";
import type { ValidatedTransitionEvent } from "../eventOperations.validation.js";

const ordinaryTransitionTargets = new Set(["SCHEDULED", "IN_PROGRESS", "COMPLETION_SUBMITTED"]);

export async function transitionEvent(
  dependencies: CleanupEventDependencies,
  input: ValidatedTransitionEvent & {
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
    assertMutableEvent(event.lifecycleStatus);
    const transition = event.currentWorkflowStatus.outgoingTransitions.find(({ toStatus }) => toStatus.id === input.targetWorkflowStatusId);
    if (!transition || !ordinaryTransitionTargets.has(transition.toStatus.mappedLifecycleStatus)) {
      throw new ApplicationError(409, "EVENT_TRANSITION_INVALID", "The requested event transition is not configured or requires its dedicated operation.");
    }
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
        lifecycleStatus: transition.toStatus.mappedLifecycleStatus,
      },
    });
    if (changed.count !== 1) throw new ApplicationError(409, "EVENT_STATE_CONFLICT", "The event changed in another request. Refresh and retry.");
    const saved = await transaction.cleanupEvent.findUniqueOrThrow({ where: { id: event.id }, select: { updatedAt: true } });
    await transaction.eventStatusHistory.create({ data: {
      cleanupEventId: event.id,
      fromWorkflowStatusId: event.currentWorkflowStatusId,
      toWorkflowStatusId: transition.toStatus.id,
      changedByMembershipId: input.actorMembershipId,
      notes: input.notes ?? null,
    } });
    await transaction.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: "CLEANUP_EVENT_STATUS_CHANGED",
      entityType: "CleanupEvent",
      entityId: event.id,
      metadata: { fromStatus: event.lifecycleStatus, toStatus: transition.toStatus.mappedLifecycleStatus },
    } });
    await notifyActiveParticipants(transaction, {
      eventId: event.id,
      organizationId: input.organizationId,
      type: "EVENT_UPDATED",
      title: "Cleanup event status updated",
      message: `${event.title} is now ${transition.toStatus.label}.`,
      extraData: { lifecycleStatus: transition.toStatus.mappedLifecycleStatus },
    });
    return {
      eventId: event.id,
      lifecycleStatus: transition.toStatus.mappedLifecycleStatus,
      updatedAt: saved.updatedAt.toISOString(),
      incidentStatus: event.incident?.status ?? null,
      rewardsAwarded: 0,
      idempotentReplay: false,
    };
  }, { timeout: 30_000 });
}
