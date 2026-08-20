import { prisma } from "../../database/prisma.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AuthorizationDependencies } from "../../authorization/authorization.types.js";
import { authorizationDependencies } from "../../authorization/authorization.dependencies.js";
import { logSpatialQueryMetric, type SpatialQueryObserver } from "../maps/map.telemetry.js";
import { eventEvidenceStorage } from "./eventOperations/eventOperations.storage.js";
import type { EventEvidenceStorage } from "./eventOperations/eventOperations.types.js";

export type CleanupEventDependencies = {
  prisma: PrismaClient;
  authorization: AuthorizationDependencies;
  spatialQueryObserver?: SpatialQueryObserver;
  eventEvidenceStorage: EventEvidenceStorage;
};

export const cleanupEventDependencies: CleanupEventDependencies = {
  prisma,
  authorization: authorizationDependencies,
  spatialQueryObserver: logSpatialQueryMetric,
  eventEvidenceStorage,
};
