import { prisma } from "../../database/prisma.js";
import { authorizationDependencies } from "../../authorization/authorization.dependencies.js";
import { cachedValue } from "../../config/redisRuntime.js";
import type { DashboardDependencies } from "./dashboard.types.js";

export const dashboardDependencies: DashboardDependencies = {
  prisma,
  authorization: authorizationDependencies,
  cache: cachedValue,
};
