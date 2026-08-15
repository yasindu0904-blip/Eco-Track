import type {
  Prisma,
  PrismaClient,
} from "../../../generated/prisma/client.js";

import type {
  CreateNotificationCommand,
  ListNotificationsCommand,
} from "../notification.types.js";

const notificationSelect = {
  id: true,
  organizationId: true,
  type: true,
  title: true,
  message: true,
  data: true,
  readAt: true,
  createdAt: true,
} as const;

type NotificationDatabase =
  | PrismaClient
  | Prisma.TransactionClient;

export async function listNotificationRecords(
  prisma: PrismaClient,
  command: ListNotificationsCommand,
) {
  return prisma.notification.findMany({
    where: {
      userId: command.userId,
      ...(command.unreadOnly
        ? { readAt: null }
        : {}),
      ...(command.cursor
        ? {
            OR: [
              {
                createdAt: {
                  lt: command.cursor.createdAt,
                },
              },
              {
                createdAt: command.cursor.createdAt,
                id: {
                  lt: command.cursor.id,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: command.limit + 1,
    select: notificationSelect,
  });
}

export async function countUnreadNotificationRecords(
  prisma: PrismaClient,
  userId: string,
): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      readAt: null,
    },
  });
}

export async function markNotificationReadRecord(
  prisma: PrismaClient,
  userId: string,
  notificationId: string,
  readAt: Date,
) {
  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
      readAt: null,
    },
    data: {
      readAt,
    },
  });

  return prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
    select: notificationSelect,
  });
}

export async function markAllNotificationRecordsRead(
  prisma: PrismaClient,
  userId: string,
  readAt: Date,
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt,
    },
  });

  return result.count;
}

export async function createNotificationRecord(
  prisma: NotificationDatabase,
  command: CreateNotificationCommand,
) {
  return prisma.notification.create({
    data: {
      userId: command.userId,
      organizationId:
        command.organizationId ?? null,
      type: command.type,
      title: command.title,
      message: command.message,
      data: command.data,
    },
    select: notificationSelect,
  });
}
