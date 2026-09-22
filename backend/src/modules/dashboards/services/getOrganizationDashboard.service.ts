import type { DashboardDependencies } from "../dashboard.types.js";
import type { DashboardRange } from "../dashboard.validation.js";
import { getOrganizationDashboardSummaryRecords } from "../repositories/dashboard.repository.js";
import { readCached } from "../../../config/redisRuntime.js";

export function getOrganizationDashboardSummary(
  dependencies: DashboardDependencies,
  organizationId: string,
  range: DashboardRange,
) {
  return readCached(dependencies.cache, "dashboard:organization",
    [organizationId, range.from?.toISOString(), range.to?.toISOString()], 30,
    () => getOrganizationDashboardSummaryRecords(dependencies.prisma, organizationId, range));
}
