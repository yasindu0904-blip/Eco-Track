import type { PrismaClient } from "../../../generated/prisma/client.js";

import { prisma } from "../../../database/prisma.js";

export type OrganizationApplicationDependencies = {
  prisma: PrismaClient;
};

export const organizationApplicationDependencies: OrganizationApplicationDependencies = {
  prisma,
};
