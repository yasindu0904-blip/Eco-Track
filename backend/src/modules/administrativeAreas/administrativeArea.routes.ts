import { Router, type Router as ExpressRouter } from "express";

import { createAuthenticationMiddleware } from "../../middleware/auth.middleware.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import type { OrganizationApplicationDependencies } from "../organizations/application/application.dependencies.js";
import { listAdministrativeAreasController } from "./controllers/listAdministrativeAreas.controller.js";

export function createAdministrativeAreaRouter(
  authenticationDependencies: AuthenticationDependencies,
  dependencies: OrganizationApplicationDependencies,
): ExpressRouter {
  const router = Router();

  router.get(
    "/administrative-areas",
    createAuthenticationMiddleware(authenticationDependencies),
    listAdministrativeAreasController(dependencies),
  );

  return router;
}
