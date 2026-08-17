import type { PrismaClient } from "../../../generated/prisma/client.js";

const requiredStatuses = [
  { code: "DRAFT", label: "Draft", lifecycle: "DRAFT", isInitial: true, isFinal: false, isActive: true },
  { code: "PUBLISHED", label: "Published", lifecycle: "PUBLISHED", isInitial: false, isFinal: false, isActive: true },
  { code: "SCHEDULED", label: "Scheduled", lifecycle: "SCHEDULED", isInitial: false, isFinal: false, isActive: true },
  { code: "IN_PROGRESS", label: "In Progress", lifecycle: "IN_PROGRESS", isInitial: false, isFinal: false, isActive: true },
  { code: "COMPLETION_SUBMITTED", label: "Completion Submitted", lifecycle: "COMPLETION_SUBMITTED", isInitial: false, isFinal: false, isActive: true },
  { code: "COMPLETED", label: "Completed", lifecycle: "COMPLETED", isInitial: false, isFinal: true, isActive: true },
  { code: "CANCELLED", label: "Cancelled", lifecycle: "CANCELLED", isInitial: false, isFinal: true, isActive: true },
] as const;

const requiredTransitions = [
  ["DRAFT", "PUBLISHED"], ["PUBLISHED", "SCHEDULED"], ["PUBLISHED", "IN_PROGRESS"],
  ["SCHEDULED", "IN_PROGRESS"], ["IN_PROGRESS", "COMPLETION_SUBMITTED"],
  ["COMPLETION_SUBMITTED", "COMPLETED"], ["PUBLISHED", "CANCELLED"],
  ["SCHEDULED", "CANCELLED"], ["IN_PROGRESS", "CANCELLED"],
  ["COMPLETION_SUBMITTED", "IN_PROGRESS"],
] as const;

export async function ensureDefaultCleanupWorkflow(prisma: PrismaClient, organizationId: string): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const existing = await transaction.cleanupWorkflowStatus.findMany({
      where: { organizationId },
      orderBy: { position: "asc" },
    });
    let nextPosition = existing.reduce((maximum, status) => Math.max(maximum, status.position), -1) + 1;
    const byLifecycle = new Map(existing.map((status) => [status.mappedLifecycleStatus, status]));

    for (const definition of requiredStatuses) {
      const existingStatus = byLifecycle.get(definition.lifecycle);

      if (existingStatus) {
        const hasProtectedValues =
          existingStatus.isInitial === definition.isInitial &&
          existingStatus.isFinal === definition.isFinal &&
          existingStatus.isActive === definition.isActive;

        if (!hasProtectedValues) {
          const repaired = await transaction.cleanupWorkflowStatus.update({
            where: { id: existingStatus.id },
            data: {
              isInitial: definition.isInitial,
              isFinal: definition.isFinal,
              isActive: definition.isActive,
            },
          });
          byLifecycle.set(definition.lifecycle, repaired);
        }

        continue;
      }

      const created = await transaction.cleanupWorkflowStatus.create({
        data: {
          organizationId,
          code: definition.code,
          label: definition.label,
          mappedLifecycleStatus: definition.lifecycle,
          position: nextPosition++,
          isInitial: definition.isInitial,
          isFinal: definition.isFinal,
          isActive: definition.isActive,
        },
      });
      byLifecycle.set(definition.lifecycle, created);
    }

    for (const [fromLifecycle, toLifecycle] of requiredTransitions) {
      const from = byLifecycle.get(fromLifecycle);
      const to = byLifecycle.get(toLifecycle);
      if (!from || !to) continue;
      await transaction.cleanupWorkflowTransition.upsert({
        where: {
          organizationId_fromStatusId_toStatusId: {
            organizationId,
            fromStatusId: from.id,
            toStatusId: to.id,
          },
        },
        create: { organizationId, fromStatusId: from.id, toStatusId: to.id },
        update: {},
      });
    }
  }, { timeout: 15_000 });
}

export function findCleanupWorkflow(prisma: PrismaClient, organizationId: string) {
  return prisma.cleanupWorkflowStatus.findMany({
    where: { organizationId },
    orderBy: [{ position: "asc" }, { code: "asc" }],
    include: { outgoingTransitions: { orderBy: { id: "asc" } } },
  });
}

export function findConfiguredTransition(
  prisma: PrismaClient,
  organizationId: string,
  fromStatusId: string,
  toStatusId: string,
) {
  return prisma.cleanupWorkflowTransition.findUnique({
    where: { organizationId_fromStatusId_toStatusId: { organizationId, fromStatusId, toStatusId } },
    include: { fromStatus: true, toStatus: true },
  });
}
