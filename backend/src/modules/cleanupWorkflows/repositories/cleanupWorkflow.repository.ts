import type { PrismaClient } from "../../../generated/prisma/client.js";

const requiredStatuses = [
  { code: "DRAFT", label: "Draft", lifecycle: "DRAFT", isInitial: true, isFinal: false },
  { code: "PUBLISHED", label: "Published", lifecycle: "PUBLISHED", isInitial: false, isFinal: false },
  { code: "SCHEDULED", label: "Scheduled", lifecycle: "SCHEDULED", isInitial: false, isFinal: false },
  { code: "IN_PROGRESS", label: "In Progress", lifecycle: "IN_PROGRESS", isInitial: false, isFinal: false },
  { code: "COMPLETION_SUBMITTED", label: "Completion Submitted", lifecycle: "COMPLETION_SUBMITTED", isInitial: false, isFinal: false },
  { code: "COMPLETED", label: "Completed", lifecycle: "COMPLETED", isInitial: false, isFinal: true },
  { code: "CANCELLED", label: "Cancelled", lifecycle: "CANCELLED", isInitial: false, isFinal: true },
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
      if (byLifecycle.has(definition.lifecycle)) continue;
      const created = await transaction.cleanupWorkflowStatus.create({
        data: {
          organizationId,
          code: definition.code,
          label: definition.label,
          mappedLifecycleStatus: definition.lifecycle,
          position: nextPosition++,
          isInitial: definition.isInitial,
          isFinal: definition.isFinal,
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
  });
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
