import type {
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client.js";

import { prisma } from "../../database/prisma.js";
import type { RateLimitConsumer } from "../../middleware/redisRateLimit.middleware.js";

export type NotificationDependencies = {
  prisma: PrismaClient;
  rateLimit?: RateLimitConsumer;
};

export type NotificationWriteDependencies = {
  prisma: PrismaClient | Prisma.TransactionClient;
};

export const notificationDependencies: NotificationDependencies = {
  prisma,
};
