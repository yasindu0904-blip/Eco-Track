import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";

export type ParticipantOperationsDatabase =
  | PrismaClient
  | Prisma.TransactionClient;

const participantOperationSelect = {
  id: true,
  cleanupEventId: true,
  userId: true,
  status: true,
  attendanceStatus: true,
  attendanceMarkedAt: true,
  attendanceMarkedByMembershipId: true,
  joinedAt: true,
  removedAt: true,
  user: { select: { id: true, fullName: true, phoneNumber: true } },
} satisfies Prisma.EventParticipantSelect;

export type ParticipantOperationRecord = Prisma.EventParticipantGetPayload<{
  select: typeof participantOperationSelect;
}>;
export type ParticipantOperationsCursor = { joinedAt: Date; id: string };

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
      startsAt: true,
      capacity: true,
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
      ...(input.cursor
        ? {
            OR: [
              { joinedAt: { lt: input.cursor.joinedAt } },
              { joinedAt: input.cursor.joinedAt, id: { lt: input.cursor.id } },
            ],
          }
        : {}),
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
