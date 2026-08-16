import { ApplicationError } from "../../../errors/applicationError.js";
import type { CleanupWorkflowDependencies } from "../cleanupWorkflow.dependencies.js";
import type { CleanupWorkflowDto } from "../cleanupWorkflow.types.js";
import { ensureDefaultCleanupWorkflow, findCleanupWorkflow, findConfiguredTransition } from "../repositories/cleanupWorkflow.repository.js";

export async function initializeAndGetCleanupWorkflow(
  dependencies: CleanupWorkflowDependencies,
  organizationId: string,
): Promise<CleanupWorkflowDto> {
  await ensureDefaultCleanupWorkflow(dependencies.prisma, organizationId);
  const records = await findCleanupWorkflow(dependencies.prisma, organizationId);
  return {
    organizationId,
    statuses: records.map(({ outgoingTransitions: _transitions, ...status }) => status),
    transitions: records.flatMap((status) => status.outgoingTransitions.map((transition) => ({
      id: transition.id,
      fromStatusId: transition.fromStatusId,
      toStatusId: transition.toStatusId,
    }))),
  };
}

export async function requireAllowedCleanupWorkflowTransition(
  dependencies: CleanupWorkflowDependencies,
  organizationId: string,
  fromStatusId: string,
  toStatusId: string,
) {
  const transition = await findConfiguredTransition(
    dependencies.prisma, organizationId, fromStatusId, toStatusId,
  );
  if (!transition || !transition.fromStatus.isActive || !transition.toStatus.isActive) {
    throw new ApplicationError(409, "CLEANUP_WORKFLOW_TRANSITION_NOT_ALLOWED", "The requested cleanup-event status transition is not configured or active.");
  }
  return transition;
}

