import { Router } from "express";
import { Actions } from "../../authorization/actions.js";
import { Subjects } from "../../authorization/subjects.js";
import { abilityMiddleware } from "../../middleware/ability.middleware.js";
import { createAuthenticationMiddleware } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { requireCompletedProfile } from "../../middleware/requireCompletedProfile.middleware.js";
import { createTenantMiddleware } from "../../middleware/tenant.middleware.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import type { CleanupEventDependencies } from "./cleanupEvent.dependencies.js";
import {
  createDraftController,
  updateDraftController,
  listMyDraftsController,
  getMyDraftController,
  createSessionController,
  removeSessionController,
  updateSessionController,
  assignCoordinatorController,
  removeCoordinatorController,
} from "./controllers/cleanupEvent.controllers.js";

export function createCleanupEventRouter(authenticationDependencies: AuthenticationDependencies, deps: CleanupEventDependencies) {
  const router = Router();
  const authenticate = createAuthenticationMiddleware(authenticationDependencies);
  const tenantRoute = [authenticate, requireCompletedProfile, createTenantMiddleware(deps.authorization), abilityMiddleware] as const;

  router.post(
    "/organizations/:organizationId/events/drafts",
    ...tenantRoute,
    authorize(Actions.Create, Subjects.CleanupEvent),
    createDraftController(deps),
  );

  router.get(
    "/organizations/:organizationId/events/drafts",
    ...tenantRoute,
    authorize(Actions.Read, Subjects.CleanupEvent),
    listMyDraftsController(deps),
  );

  router.get(
    "/organizations/:organizationId/events/drafts/:id",
    ...tenantRoute,
    authorize(Actions.Read, Subjects.CleanupEvent),
    getMyDraftController(deps),
  );

  router.patch(
    "/organizations/:organizationId/events/drafts/:id",
    ...tenantRoute,
    authorize(Actions.Update, Subjects.CleanupEvent),
    updateDraftController(deps),
  );

  router.post(
    "/organizations/:organizationId/events/:eventId/sessions",
    ...tenantRoute,
    authorize(Actions.Update, Subjects.EventSession),
    createSessionController(deps),
  );

  router.delete(
    "/organizations/:organizationId/events/:eventId/sessions/:sessionId",
    ...tenantRoute,
    authorize(Actions.Update, Subjects.EventSession),
    removeSessionController(deps),
  );

  router.patch(
    "/organizations/:organizationId/events/:eventId/sessions/:sessionId",
    ...tenantRoute,
    authorize(Actions.Update, Subjects.EventSession),
    updateSessionController(deps),
  );

  router.post(
    "/organizations/:organizationId/events/:eventId/coordinators",
    ...tenantRoute,
    authorize(Actions.AssignCoordinator, Subjects.EventCoordinator),
    assignCoordinatorController(deps),
  );

  router.delete(
    "/organizations/:organizationId/events/:eventId/coordinators",
    ...tenantRoute,
    authorize(Actions.AssignCoordinator, Subjects.EventCoordinator),
    removeCoordinatorController(deps),
  );

  return router;
}
