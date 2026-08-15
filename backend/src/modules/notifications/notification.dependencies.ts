import type { PrismaClient } from "../../generated/prisma/client.js";

import { prisma } from "../../database/prisma.js";

export type NotificationDependencies = {
  prisma: PrismaClient;
};

export const notificationDependencies: NotificationDependencies = {
  prisma,
};
