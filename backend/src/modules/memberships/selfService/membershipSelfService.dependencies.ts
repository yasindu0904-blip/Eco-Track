import type { PrismaClient } from "../../../generated/prisma/client.js";

import { prisma } from "../../../database/prisma.js";

export type MembershipSelfServiceDependencies = {
  prisma: PrismaClient;
};

export const membershipSelfServiceDependencies: MembershipSelfServiceDependencies = {
  prisma,
};
