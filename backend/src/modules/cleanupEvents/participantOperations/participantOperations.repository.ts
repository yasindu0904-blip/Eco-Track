import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";

export type ParticipantOperationsDatabase = PrismaClient | Prisma.TransactionClient;

const participantOperationSelect = {
  id: true,
  cleanupEventId: true,
  userId: true,
  status: true,
  joinedAt: true,
  removedAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
    },
  },
  availabilities: {
    orderBy: { markedAt: "asc" as const },
    select: { sessionId: true },
  },
  allocations: {
    orderBy: { allocatedAt: "asc" as const },
    select: {
      id: true,
      participantId: true,
      sessionId: true,
      status: true,
      allocatedAt: true,
      attendanceMarkedAt: true,
      notes: true,
    },
  },
} satisfies Prisma.EventParticipantSelect;

export type ParticipantOperationRecord = Prisma.EventParticipantGetPayload<{
  select: typeof participantOperationSelect;
}>;

export type ParticipantOperationsCursor = {
  joinedAt: Date;
  id: string;
};

export function findParticipantOperationsEvent(
  database: ParticipantOperationsDatabase,
  organizationId: string,
  eventId: string,
) {
  return database.cleanupEvent.findFirst({
    where: { id: eventId, organizationId },
    select: {
      id: true,
      organizationId: true,
      title: true,
      lifecycleStatus: true,
      sessions: {
        orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
        select: {
          id: true,
          cleanupEventId: true,
          sessionDate: true,
          startTime: true,
          endTime: true,
          status: true,
          capacity: true,
          _count: {
            select: {
              allocations: {
                where: { status: { not: "REMOVED" } },
              },
            },
          },
        },
      },
    },
  });
}

export function listParticipantOperationRecords(
  database: ParticipantOperationsDatabase,
  input: {
    eventId: string;
    status: "JOINED" | "WITHDRAWN" | "REMOVED";
    limit: number;
    cursor: ParticipantOperationsCursor | null;
  },
): Promise<ParticipantOperationRecord[]> {
  return database.eventParticipant.findMany({
    where: {
      cleanupEventId: input.eventId,
      status: input.status,
      ...(input.cursor ? {
        OR: [
          { joinedAt: { lt: input.cursor.joinedAt } },
          { joinedAt: input.cursor.joinedAt, id: { lt: input.cursor.id } },
        ],
      } : {}),
    },
    orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
    take: input.limit + 1,
    select: participantOperationSelect,
  });
}

export function findParticipantOperationRecord(
  database: ParticipantOperationsDatabase,
  organizationId: string,
  eventId: string,
  participantId: string,
): Promise<ParticipantOperationRecord | null> {
  return database.eventParticipant.findFirst({
    where: {
      id: participantId,
      cleanupEventId: eventId,
      cleanupEvent: { organizationId },
    },
    select: participantOperationSelect,
  });
}

export function findAllocationOperationRecord(
  database: ParticipantOperationsDatabase,
  organizationId: string,
  eventId: string,
  allocationId: string,
) {
  return database.sessionAllocation.findFirst({
    where: {
      id: allocationId,
      participant: {
        cleanupEventId: eventId,
        cleanupEvent: { organizationId },
      },
    },
    select: {
      id: true,
      participantId: true,
      sessionId: true,
      status: true,
      allocatedAt: true,
      attendanceMarkedAt: true,
      notes: true,
      participant: {
        select: {
          userId: true,
          status: true,
          cleanupEventId: true,
          availabilities: { select: { sessionId: true } },
        },
      },
      session: {
        select: {
          id: true,
          cleanupEventId: true,
          sessionDate: true,
          startTime: true,
          status: true,
          capacity: true,
        },
      },
    },
  });
}

export function findParticipantSessionAllocation(
  database: ParticipantOperationsDatabase,
  participantId: string,
  sessionId: string,
) {
  return database.sessionAllocation.findUnique({
    where: { participantId_sessionId: { participantId, sessionId } },
    select: {
      id: true,
      participantId: true,
      sessionId: true,
      status: true,
      allocatedAt: true,
      attendanceMarkedAt: true,
      notes: true,
    },
  });
}

export function countActiveSessionAllocations(
  database: ParticipantOperationsDatabase,
  sessionId: string,
) {
  return database.sessionAllocation.count({
    where: { sessionId, status: { not: "REMOVED" } },
  });
}

