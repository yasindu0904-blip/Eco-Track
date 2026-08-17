import type {
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client.js";

import { prisma } from "../../database/prisma.js";

export type NotificationDependencies = {
  prisma: PrismaClient;
};

export type NotificationWriteDependencies = {
  prisma: PrismaClient | Prisma.TransactionClient;
};

export const notificationDependencies: NotificationDependencies = {
  prisma,
};
