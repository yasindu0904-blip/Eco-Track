import type { DashboardDependencies } from "../dashboard.types.js";
import type { DashboardRange } from "../dashboard.validation.js";
import { getPlatformDashboardSummaryRecords } from "../repositories/dashboard.repository.js";

export function getPlatformDashboardSummary(
  dependencies: DashboardDependencies,
  range: DashboardRange,
) {
  return getPlatformDashboardSummaryRecords(
    dependencies.prisma,
    range,
  );
}
