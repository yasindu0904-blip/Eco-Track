import { Router, type Router as ExpressRouter } from "express";

import { Actions } from "../../authorization/actions.js";
import { Subjects } from "../../authorization/subjects.js";
import { abilityMiddleware } from "../../middleware/ability.middleware.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import type { DashboardDependencies } from "./dashboard.types.js";
import { createAuthenticationMiddleware } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { requireCompletedProfile } from "../../middleware/requireCompletedProfile.middleware.js";
import { createTenantMiddleware } from "../../middleware/tenant.middleware.js";

import { getCitizenDashboardController } from "./controllers/getCitizenDashboard.controller.js";
import { getOrganizationDashboardController } from "./controllers/getOrganizationDashboard.controller.js";
import { getPlatformDashboardController } from "./controllers/getPlatformDashboard.controller.js";

export function createDashboardRouter(auth: AuthenticationDependencies, dependencies: DashboardDependencies): ExpressRouter {
  const router = Router();
  const authenticate = createAuthenticationMiddleware(auth);

  router.get(
    "/dashboards/citizen",
    authenticate,
    requireCompletedProfile,
    abilityMiddleware,
    authorize(Actions.ReadOwn, Subjects.Dashboard),
    getCitizenDashboardController(dependencies),
  );

  router.get(
    "/organizations/:organizationId/dashboard-summary",
    authenticate,
    requireCompletedProfile,
    createTenantMiddleware(dependencies.authorization),
    abilityMiddleware,
    authorize(Actions.Read, Subjects.Dashboard),
    getOrganizationDashboardController(dependencies),
  );

  router.get(
    "/dashboards/platform",
    authenticate,
    requireCompletedProfile,
    abilityMiddleware,
    authorize(Actions.Read, Subjects.Dashboard),
    getPlatformDashboardController(dependencies),
  );

  return router;
}
