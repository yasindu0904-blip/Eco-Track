import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";

export type EventOperationsDatabase = PrismaClient | Prisma.TransactionClient;

const eventOperationsSelect = {
  id: true,
  organizationId: true,
  incidentId: true,
  title: true,
  lifecycleStatus: true,
  updatedAt: true,
  completedAt: true,
  cancelledAt: true,
  cancellationReason: true,
  currentWorkflowStatusId: true,
  currentWorkflowStatus: {
    select: {
      id: true,
      code: true,
      label: true,
      mappedLifecycleStatus: true,
      outgoingTransitions: {
        where: { toStatus: { isActive: true } },
        orderBy: { toStatus: { position: "asc" as const } },
        select: {
          toStatus: {
            select: {
              id: true,
              code: true,
              label: true,
              mappedLifecycleStatus: true,
            },
          },
        },
      },
    },
  },
  incident: {
    select: {
      id: true,
      reporterUserId: true,
      status: true,
      highlightUntil: true,
      archiveAfter: true,
    },
  },
  sessions: {
    orderBy: [{ sessionDate: "asc" as const }, { startTime: "asc" as const }],
    select: {
      id: true,
      sessionDate: true,
      startTime: true,
      endTime: true,
      status: true,
      updatedAt: true,
    },
  },
  notes: {
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    take: 100,
    select: {
      id: true,
      visibility: true,
      noteText: true,
      createdAt: true,
      author: { select: { id: true, user: { select: { fullName: true } } } },
    },
  },
  evidence: {
    orderBy: [{ uploadedAt: "desc" as const }, { id: "desc" as const }],
    take: 100,
    select: {
      id: true,
      sessionId: true,
      type: true,
      storagePath: true,
      caption: true,
      uploadedAt: true,
      uploadedBy: { select: { id: true, fullName: true } },
    },
  },
  statusHistory: {
    orderBy: [{ changedAt: "desc" as const }, { id: "desc" as const }],
    take: 100,
    select: {
      id: true,
      notes: true,
      changedAt: true,
      fromStatus: { select: { id: true, label: true, mappedLifecycleStatus: true } },
      toStatus: { select: { id: true, label: true, mappedLifecycleStatus: true } },
      changedBy: { select: { id: true, user: { select: { fullName: true } } } },
    },
  },
  participants: {
    select: {
      id: true,
      userId: true,
      status: true,
      allocations: { select: { id: true, status: true } },
    },
  },
} satisfies Prisma.CleanupEventSelect;

export type EventOperationsRecord = Prisma.CleanupEventGetPayload<{
  select: typeof eventOperationsSelect;
}>;

export function findEventOperationsRecord(
  database: EventOperationsDatabase,
  organizationId: string,
  eventId: string,
) {
  return database.cleanupEvent.findFirst({
    where: { id: eventId, organizationId },
    select: eventOperationsSelect,
  });
}

export function findParticipantUpdatesRecord(
  database: EventOperationsDatabase,
  eventId: string,
  userId: string,
) {
  return database.cleanupEvent.findFirst({
    where: {
      id: eventId,
      publishedAt: { not: null },
      participants: {
        some: { userId, status: { in: ["JOINED", "WITHDRAWN"] } },
      },
    },
    select: {
      id: true,
      title: true,
      lifecycleStatus: true,
      completedAt: true,
      cancelledAt: true,
      cancellationReason: true,
      notes: {
        where: { visibility: "PARTICIPANTS" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
        select: {
          id: true,
          visibility: true,
          noteText: true,
          createdAt: true,
          author: { select: { id: true, user: { select: { fullName: true } } } },
        },
      },
    },
  });
}

export function createEventNoteRecord(
  database: EventOperationsDatabase,
  input: {
    eventId: string;
    authorMembershipId: string;
    visibility: "PARTICIPANTS" | "INTERNAL";
    noteText: string;
  },
) {
  return database.eventNote.create({
    data: {
      cleanupEventId: input.eventId,
      authorMembershipId: input.authorMembershipId,
      visibility: input.visibility,
      noteText: input.noteText,
    },
    select: {
      id: true,
      visibility: true,
      noteText: true,
      createdAt: true,
      author: { select: { id: true, user: { select: { fullName: true } } } },
    },
  });
}

export function createEventEvidenceRecord(
  database: EventOperationsDatabase,
  input: {
    eventId: string;
    sessionId: string | null;
    uploadedByUserId: string;
    type: "BEFORE" | "PROGRESS" | "AFTER";
    storagePath: string;
    caption: string | null;
  },
) {
  return database.eventEvidence.create({
    data: {
      cleanupEventId: input.eventId,
      sessionId: input.sessionId,
      uploadedByUserId: input.uploadedByUserId,
      type: input.type,
      storagePath: input.storagePath,
      caption: input.caption,
    },
    select: {
      id: true,
      sessionId: true,
      type: true,
      storagePath: true,
      caption: true,
      uploadedAt: true,
      uploadedBy: { select: { id: true, fullName: true } },
    },
  });
}

export function listActiveParticipantUserIds(
  database: EventOperationsDatabase,
  eventId: string,
) {
  return database.eventParticipant.findMany({
    where: { cleanupEventId: eventId, status: "JOINED" },
    select: { userId: true },
  });
}
