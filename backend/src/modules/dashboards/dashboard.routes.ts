import { Router, type Router as ExpressRouter } from "express";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import type { DashboardDependencies } from "./dashboard.types.js";
import { createAuthenticationMiddleware } from "../../middleware/auth.middleware.js";
import { requireCompletedProfile } from "../../middleware/requireCompletedProfile.middleware.js";
import { createTenantMiddleware } from "../../middleware/tenant.middleware.js";
import { ApplicationError } from "../../errors/applicationError.js";
import { parseDashboardRange } from "./dashboard.validation.js";
import { citizenSummary, organizationSummary, platformSummary } from "./dashboard.repository.js";

const sendError = (next: (error?: unknown) => void, error: unknown) => next(error);

export function createDashboardRouter(auth: AuthenticationDependencies, dependencies: DashboardDependencies): ExpressRouter {
  const router = Router();
  const authenticate = createAuthenticationMiddleware(auth);
  router.get("/dashboards/citizen", authenticate, requireCompletedProfile, async (request, response, next) => {
    try {
      if (request.authentication.profile.platformRole !== "USER") throw new ApplicationError(403, "CITIZEN_DASHBOARD_DENIED", "Citizen dashboard access is required.");
      response.json({ data: await citizenSummary(dependencies.prisma, request.authentication.profile.id, parseDashboardRange(request.query)) });
    } catch (error) { sendError(next, error); }
  });
  router.get("/organizations/:organizationId/dashboard-summary", authenticate, requireCompletedProfile, createTenantMiddleware(dependencies.authorization), async (request, response, next) => {
    try { response.json({ data: await organizationSummary(dependencies.prisma, request.tenant!.organization.id, parseDashboardRange(request.query)) }); }
    catch (error) { sendError(next, error); }
  });
  router.get("/dashboards/platform", authenticate, requireCompletedProfile, async (request, response, next) => {
    try {
      if (request.authentication.profile.platformRole !== "SUPER_ADMIN") throw new ApplicationError(403, "PLATFORM_DASHBOARD_DENIED", "Super Admin access is required.");
      response.json({ data: await platformSummary(dependencies.prisma, parseDashboardRange(request.query)) });
    } catch (error) { sendError(next, error); }
  });
  return router;
}
