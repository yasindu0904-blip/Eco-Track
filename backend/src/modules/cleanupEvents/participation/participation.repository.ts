import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";

export const joinableLifecycleStatuses = ["PUBLISHED"] as const;

const participantEventSelect = {
  id: true,
  organizationId: true,
  incidentId: true,
  lifecycleStatus: true,
  title: true,
  description: true,
  publicInstructions: true,
  eventLatitude: true,
  eventLongitude: true,
  eventAddress: true,
  meetingLatitude: true,
  meetingLongitude: true,
  meetingAddress: true,
  startsAt: true,
  capacity: true,
  publishedAt: true,
  updatedAt: true,
  organization: { select: { id: true, name: true } },
  _count: {
    select: { participants: { where: { status: "JOINED" as const } } },
  },
} satisfies Prisma.CleanupEventSelect;

export const participationInclude = {
  cleanupEvent: { select: participantEventSelect },
} satisfies Prisma.EventParticipantInclude;

export type ParticipationRecord = Prisma.EventParticipantGetPayload<{
  include: typeof participationInclude;
}>;
export type ParticipationCursor = { joinedAt: Date; id: string };

export function findParticipation(
  database: PrismaClient | Prisma.TransactionClient,
  eventId: string,
  userId: string,
): Promise<ParticipationRecord | null> {
  return database.eventParticipant.findUnique({
    where: { cleanupEventId_userId: { cleanupEventId: eventId, userId } },
    include: participationInclude,
  });
}

export function findParticipationEvent(
  database: PrismaClient | Prisma.TransactionClient,
  eventId: string,
) {
  return database.cleanupEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      organizationId: true,
      lifecycleStatus: true,
      title: true,
      startsAt: true,
      capacity: true,
      _count: { select: { participants: { where: { status: "JOINED" } } } },
      organization: {
        select: {
          memberships: {
            where: { role: "ORG_ADMIN", status: "ACTIVE" },
            select: { userId: true },
          },
        },
      },
      coordinators: {
        where: { removedAt: null, membership: { status: "ACTIVE" } },
        select: { membership: { select: { userId: true } } },
      },
    },
  });
}

export function listMyParticipationRecords(
  database: PrismaClient,
  command: {
    userId: string;
    scope: "active" | "history" | "all";
    limit: number;
    cursor: ParticipationCursor | null;
  },
): Promise<ParticipationRecord[]> {
  const status =
    command.scope === "active"
      ? { in: ["JOINED" as const] }
      : command.scope === "history"
        ? { in: ["WITHDRAWN" as const, "REMOVED" as const] }
        : undefined;
  return database.eventParticipant.findMany({
    where: {
      userId: command.userId,
      ...(status ? { status } : {}),
      ...(command.cursor
        ? {
            OR: [
              { joinedAt: { lt: command.cursor.joinedAt } },
              {
                joinedAt: command.cursor.joinedAt,
                id: { lt: command.cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
    take: command.limit + 1,
    include: participationInclude,
  });
}
