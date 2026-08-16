import { prisma } from "../../../database/prisma.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";

export type MembershipAdministrationDependencies = {
  prisma: PrismaClient;
};

export const membershipAdministrationDependencies: MembershipAdministrationDependencies = {
  prisma,
};
