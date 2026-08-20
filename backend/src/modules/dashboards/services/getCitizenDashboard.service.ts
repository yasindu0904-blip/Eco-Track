import type { DashboardDependencies } from "../dashboard.types.js";
import type { DashboardRange } from "../dashboard.validation.js";
import { getCitizenDashboardSummaryRecords } from "../repositories/dashboard.repository.js";

export function getCitizenDashboardSummary(
  dependencies: DashboardDependencies,
  userId: string,
  range: DashboardRange,
) {
  return getCitizenDashboardSummaryRecords(
    dependencies.prisma,
    userId,
    range,
  );
}
