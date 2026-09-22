import type { PrismaClient } from "../../../generated/prisma/client.js";

import { prisma } from "../../../database/prisma.js";
import { cachedValue } from "../../../config/redisRuntime.js";

export type OrganizationApplicationDependencies = {
  prisma: PrismaClient;
  cache?: typeof cachedValue;
};

export const organizationApplicationDependencies: OrganizationApplicationDependencies = {
  prisma,
  cache: cachedValue,
};
