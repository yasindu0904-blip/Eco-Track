import type { DashboardDependencies } from "../dashboard.types.js";
import type { DashboardRange } from "../dashboard.validation.js";
import { getOrganizationDashboardSummaryRecords } from "../repositories/dashboard.repository.js";

export function getOrganizationDashboardSummary(
  dependencies: DashboardDependencies,
  organizationId: string,
  range: DashboardRange,
) {
  return getOrganizationDashboardSummaryRecords(
    dependencies.prisma,
    organizationId,
    range,
  );
}
