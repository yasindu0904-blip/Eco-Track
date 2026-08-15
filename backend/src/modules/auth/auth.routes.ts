import {
  Router,
  type Router as ExpressRouter,
} from "express";

import { Actions } from "../../authorization/actions.js";
import { Subjects } from "../../authorization/subjects.js";
import { abilityMiddleware } from "../../middleware/ability.middleware.js";
import { createAuthenticationMiddleware } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { requireCompletedProfile } from "../../middleware/requireCompletedProfile.middleware.js";

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
    requireCompletedProfile,
    abilityMiddleware,
    authorize(Actions.Read, Subjects.Platform),
    superAdminPingController,
  );

  return router;
}
