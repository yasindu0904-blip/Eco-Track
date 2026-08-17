import type { PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../../database/prisma.js";
import type { IncidentStorage } from "./incident.types.js";
import { incidentStorage } from "./incident.storage.js";

export interface IncidentDependencies {
  prisma: PrismaClient;
  storage: IncidentStorage;
}

export const incidentDependencies: IncidentDependencies = {
  prisma,
  storage: incidentStorage,
};
