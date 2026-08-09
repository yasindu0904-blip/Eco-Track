import {
  Router,
  type Router as ExpressRouter,
} from "express";

import { createAuthenticationMiddleware } from "../../middleware/auth.middleware.js";
import { requireActiveSuperAdmin } from "../../middleware/requireSuperAdmin.middleware.js";

import { getCurrentUserController } from "./controllers/getCurrentUser.controller.js";
import { superAdminPingController } from "./controllers/superAdminPing.controller.js";

import type { AuthenticationDependencies } from "./auth.types.js";

export function createAuthRouter(
  dependencies: AuthenticationDependencies,
): ExpressRouter {
  const router = Router();

  const authenticate =
    createAuthenticationMiddleware(dependencies);

  router.get(
    "/auth/me",
    authenticate,
    getCurrentUserController,
  );

  router.get(
    "/super-admin/ping",
    authenticate,
    requireActiveSuperAdmin,
    superAdminPingController,
  );

  return router;
}