import { Router } from "express";
import { Actions } from "../../authorization/actions.js";
import { createAuthorizationSubject, Subjects } from "../../authorization/subjects.js";
import { abilityMiddleware } from "../../middleware/ability.middleware.js";
import { createAuthenticationMiddleware } from "../../middleware/auth.middleware.js";
import { authorize, authorizeResource } from "../../middleware/authorize.middleware.js";
import { createEventAuthorizationMiddleware } from "../../middleware/eventAuthorization.middleware.js";
import { requireCompletedProfile } from "../../middleware/requireCompletedProfile.middleware.js";
import { createTenantMiddleware } from "../../middleware/tenant.middleware.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import type { CleanupEventDependencies } from "./cleanupEvent.dependencies.js";
import {
  createDraftController,
  discardDraftController,
  updateDraftController,
  listOrganizationDraftsController,
  getOrganizationDraftController,
  createSessionController,
  removeSessionController,
  updateSessionController,
  assignCoordinatorController,
  removeCoordinatorController,
  getOwnedEventController,
  getPublicEventController,
  listOwnedEventsController,
  listPublicEventMapController,
  listNearbyPublicEventMapController,
  listOrganizationEventMapController,
  listPublicEventsController,
  publishEventController,
  publishReadinessController,
} from "./controllers/cleanupEvent.controllers.js";
import {
  getMyParticipationController,
  joinEventController,
  listMyParticipationsController,
  updateAvailabilityController,
  withdrawFromEventController,
} from "./participation/participation.controllers.js";

export function createCleanupEventRouter(authenticationDependencies: AuthenticationDependencies, deps: CleanupEventDependencies) {
  const router = Router();
  const authenticate = createAuthenticationMiddleware(authenticationDependencies);
  const tenantRoute = [authenticate, requireCompletedProfile, createTenantMiddleware(deps.authorization), abilityMiddleware] as const;
  const publicRoute = [authenticate, requireCompletedProfile, abilityMiddleware] as const;
  const publishRoute = [
    authenticate,
    requireCompletedProfile,
    createTenantMiddleware(deps.authorization),
    createEventAuthorizationMiddleware(deps.authorization),
    abilityMiddleware,
    authorizeResource(Actions.Publish, (request) =>
      createAuthorizationSubject(
        Subjects.CleanupEvent,
        request.eventAuthorization!.cleanupEvent,
      )),
  ] as const;

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
    listOrganizationDraftsController(deps),
  );

  router.get(
    "/organizations/:organizationId/events",
    ...tenantRoute,
    authorize(Actions.Read, Subjects.CleanupEvent),
    listOwnedEventsController(deps),
  );

  router.get(
    "/organizations/:organizationId/events/map",
    ...tenantRoute,
    authorize(Actions.Read, Subjects.CleanupEvent),
    listOrganizationEventMapController(deps),
  );

  router.get(
    "/organizations/:organizationId/events/:eventId",
    ...tenantRoute,
    authorize(Actions.Read, Subjects.CleanupEvent),
    getOwnedEventController(deps),
  );

  router.get(
    "/organizations/:organizationId/events/drafts/:id",
    ...tenantRoute,
    authorize(Actions.Read, Subjects.CleanupEvent),
    getOrganizationDraftController(deps),
  );

  router.patch(
    "/organizations/:organizationId/events/drafts/:id",
    ...tenantRoute,
    authorize(Actions.Update, Subjects.CleanupEvent),
    updateDraftController(deps),
  );

  router.delete(
    "/organizations/:organizationId/events/drafts/:id",
    ...tenantRoute,
    authorize(Actions.Update, Subjects.CleanupEvent),
    discardDraftController(deps),
  );

  router.get(
    "/organizations/:organizationId/events/:eventId/publish-readiness",
    ...publishRoute,
    publishReadinessController(deps),
  );

  router.post(
    "/organizations/:organizationId/events/:eventId/publish",
    ...publishRoute,
    publishEventController(deps),
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

  router.get(
    "/events/map",
    ...publicRoute,
    authorize(Actions.Read, Subjects.CleanupEvent),
    listPublicEventMapController(deps),
  );

  router.get(
    "/events/nearby",
    ...publicRoute,
    authorize(Actions.Read, Subjects.CleanupEvent),
    listNearbyPublicEventMapController(deps),
  );

  router.get(
    "/events",
    ...publicRoute,
    authorize(Actions.Read, Subjects.CleanupEvent),
    listPublicEventsController(deps),
  );

  router.get(
    "/events/:eventId",
    ...publicRoute,
    authorize(Actions.Read, Subjects.CleanupEvent),
    getPublicEventController(deps),
  );

  router.get(
    "/event-participations/me",
    ...publicRoute,
    authorize(Actions.ReadOwn, Subjects.EventParticipant),
    listMyParticipationsController(deps),
  );

  router.get(
    "/events/:eventId/participation",
    ...publicRoute,
    authorize(Actions.ReadOwn, Subjects.EventParticipant),
    getMyParticipationController(deps),
  );

  router.post(
    "/events/:eventId/participation",
    ...publicRoute,
    authorize(Actions.Join, Subjects.CleanupEvent),
    joinEventController(deps),
  );

  router.put(
    "/events/:eventId/participation/availability",
    ...publicRoute,
    authorize(Actions.ManageAvailability, Subjects.ParticipantAvailability),
    updateAvailabilityController(deps),
  );

  router.post(
    "/events/:eventId/participation/withdraw",
    ...publicRoute,
    authorize(Actions.Withdraw, Subjects.EventParticipant),
    withdrawFromEventController(deps),
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
