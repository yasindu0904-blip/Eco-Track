import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AuthorizationDependencies } from "../../authorization/authorization.types.js";
import { authorizationDependencies } from "../../authorization/authorization.dependencies.js";
import { prisma } from "../../database/prisma.js";
import type { IncidentStorage } from "./incident.types.js";
import { incidentStorage } from "./incident.storage.js";
import { logSpatialQueryMetric, type SpatialQueryObserver } from "../maps/map.telemetry.js";
import { cachedValue, consumeRateLimit } from "../../config/redisRuntime.js";
import type { RateLimitConsumer } from "../../middleware/redisRateLimit.middleware.js";

export interface IncidentDependencies {
  prisma: PrismaClient;
  storage: IncidentStorage;
  authorization: AuthorizationDependencies;
  spatialQueryObserver?: SpatialQueryObserver;
  cache?: typeof cachedValue;
  rateLimit?: RateLimitConsumer;
}

export const incidentDependencies: IncidentDependencies = {
  prisma,
  storage: incidentStorage,
  authorization: authorizationDependencies,
  spatialQueryObserver: logSpatialQueryMetric,
  cache: cachedValue,
  rateLimit: consumeRateLimit,
};
