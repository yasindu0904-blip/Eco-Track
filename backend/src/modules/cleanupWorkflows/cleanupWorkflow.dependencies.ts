import type { PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../../database/prisma.js";

export type CleanupWorkflowDependencies = {
  prisma: PrismaClient;
};

export const cleanupWorkflowDependencies: CleanupWorkflowDependencies = {
  prisma,
};

