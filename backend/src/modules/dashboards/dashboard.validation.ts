import { z } from "zod";
import { ApplicationError } from "../../errors/applicationError.js";

const date = z.iso.datetime({ offset: true });

export const dashboardRangeSchema = z.object({
  from: date.optional(),
  to: date.optional(),
}).superRefine((value, context) => {
  if (!value.from || !value.to) return;
  const from = new Date(value.from);
  const to = new Date(value.to);
  if (from >= to) {
    context.addIssue({ code: "custom", path: ["to"], message: "to must be later than from" });
  } else if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    context.addIssue({ code: "custom", path: ["to"], message: "date range cannot exceed 366 days" });
  }
});

export type DashboardRange = { from?: Date; to?: Date };

export function parseDashboardRange(query: unknown): DashboardRange {
  const result = dashboardRangeSchema.safeParse(query);
  if (!result.success) throw new ApplicationError(400, "DASHBOARD_RANGE_INVALID", "The dashboard date range is invalid.", { issues: result.error.issues });
  const value = result.data;
  return {
    from: value.from ? new Date(value.from) : undefined,
    to: value.to ? new Date(value.to) : undefined,
  };
}
