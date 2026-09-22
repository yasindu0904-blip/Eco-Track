import type { DashboardDependencies } from "../dashboard.types.js";
import type { DashboardRange } from "../dashboard.validation.js";
import { getPlatformDashboardSummaryRecords } from "../repositories/dashboard.repository.js";
import { readCached } from "../../../config/redisRuntime.js";

export function getPlatformDashboardSummary(
  dependencies: DashboardDependencies,
  range: DashboardRange,
) {
  return readCached(dependencies.cache, "dashboard:platform",
    [range.from?.toISOString(), range.to?.toISOString()], 30,
    () => getPlatformDashboardSummaryRecords(dependencies.prisma, range));
}
