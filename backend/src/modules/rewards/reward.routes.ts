import { Router, type Router as ExpressRouter } from "express";

import { Actions } from "../../authorization/actions.js";
import { Subjects } from "../../authorization/subjects.js";
import { abilityMiddleware } from "../../middleware/ability.middleware.js";
import { createAuthenticationMiddleware } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { requireCompletedProfile } from "../../middleware/requireCompletedProfile.middleware.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";

import { getMyImpactSummaryController } from "./controllers/getMyImpactSummary.controller.js";
import { listMyContributionsController } from "./controllers/listMyContributions.controller.js";
import type { RewardDependencies } from "./reward.dependencies.js";

export function createRewardRouter(
  authenticationDependencies: AuthenticationDependencies,
  rewardDependencies: RewardDependencies,
): ExpressRouter {
  const router = Router();
  const authenticate = createAuthenticationMiddleware(authenticationDependencies);
  const readOwnContributions = authorize(Actions.ReadOwn, Subjects.Contribution);
  const readOwnAchievements = authorize(Actions.ReadOwn, Subjects.Achievement);

  router.get(
    "/rewards/me/summary",
    authenticate,
    requireCompletedProfile,
    abilityMiddleware,
    readOwnContributions,
    readOwnAchievements,
    getMyImpactSummaryController(rewardDependencies),
  );

  router.get(
    "/rewards/me/contributions",
    authenticate,
    requireCompletedProfile,
    abilityMiddleware,
    readOwnContributions,
    listMyContributionsController(rewardDependencies),
  );

  return router;
}
