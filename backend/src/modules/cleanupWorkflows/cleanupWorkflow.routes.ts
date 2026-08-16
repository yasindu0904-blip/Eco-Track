import { Router, type Router as ExpressRouter } from "express";
import { Actions } from "../../authorization/actions.js";
import { Subjects } from "../../authorization/subjects.js";
import type { AuthorizationDependencies } from "../../authorization/authorization.types.js";
import { abilityMiddleware } from "../../middleware/ability.middleware.js";
import { createAuthenticationMiddleware } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { requireCompletedProfile } from "../../middleware/requireCompletedProfile.middleware.js";
import { createTenantMiddleware } from "../../middleware/tenant.middleware.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import type { CleanupWorkflowDependencies } from "./cleanupWorkflow.dependencies.js";
import { getCleanupWorkflowController } from "./controllers/getCleanupWorkflow.controller.js";

export function createCleanupWorkflowRouter(
  authenticationDependencies: AuthenticationDependencies,
  authorizationDependencies: AuthorizationDependencies,
  workflowDependencies: CleanupWorkflowDependencies,
): ExpressRouter {
  const router = Router();
  router.get(
    "/organizations/:organizationId/cleanup-workflow",
    createAuthenticationMiddleware(authenticationDependencies),
    requireCompletedProfile,
    createTenantMiddleware(authorizationDependencies),
    abilityMiddleware,
    authorize(Actions.Read, Subjects.CleanupWorkflow),
    getCleanupWorkflowController(workflowDependencies),
  );
  return router;
}

