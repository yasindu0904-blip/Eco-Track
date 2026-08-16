import { Router, type Router as ExpressRouter } from "express";

import { Actions } from "../../authorization/actions.js";
import { Subjects } from "../../authorization/subjects.js";
import { abilityMiddleware } from "../../middleware/ability.middleware.js";
import { createAuthenticationMiddleware } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { requireCompletedProfile } from "../../middleware/requireCompletedProfile.middleware.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import { completeProfileController } from "./controllers/completeProfile.controller.js";
import { updateProfileController } from "./controllers/updateProfile.controller.js";

export function createProfileRouter(
  authenticationDependencies: AuthenticationDependencies,
): ExpressRouter {
  const router = Router();
  const authenticate = createAuthenticationMiddleware(
    authenticationDependencies,
  );

  router.put(
    "/profile/complete",
    authenticate,
    abilityMiddleware,
    authorize(Actions.Update, Subjects.UserProfile),
    completeProfileController,
  );

  router.patch(
    "/profile",
    authenticate,
    requireCompletedProfile,
    abilityMiddleware,
    authorize(Actions.Update, Subjects.UserProfile),
    updateProfileController,
  );

  return router;
}
