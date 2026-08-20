import { Router } from "express";
import type { Request } from "express";
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
import {
  allocateParticipantController,
  listEventParticipantsController,
  reallocateParticipantController,
  recordAttendanceController,
  removeAllocationController,
  removeParticipantController,
} from "./participantOperations/participantOperations.controllers.js";
import {
  addEventNoteController,
  cancelEventController,
  completeEventController,
  createEventEvidenceUploadIntentsController,
  getCompletionReadinessController,
  getEventOperationsController,
  getParticipantEventUpdatesController,
  registerEventEvidenceController,
  transitionEventController,
  transitionSessionController,
} from "./eventOperations/eventOperations.controllers.js";

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
  const eventOperationsRoute = [
    authenticate,
    requireCompletedProfile,
    createTenantMiddleware(deps.authorization),
    createEventAuthorizationMiddleware(deps.authorization),
    abilityMiddleware,
  ] as const;
  const participantResource = (request: Request) =>
    createAuthorizationSubject(Subjects.EventParticipant, {
      id: request.params.participantId ?? "participant-list",
      cleanupEventId: request.eventAuthorization!.cleanupEvent.id,
      cleanupEvent: { organizationId: request.eventAuthorization!.cleanupEvent.organizationId },
    });
  const allocationResource = (request: Request) =>
    createAuthorizationSubject(Subjects.SessionAllocation, {
      id: request.params.allocationId ?? "new-allocation",
      participant: {
        cleanupEventId: request.eventAuthorization!.cleanupEvent.id,
        cleanupEvent: { organizationId: request.eventAuthorization!.cleanupEvent.organizationId },
      },
    });
  const eventResource = (request: Request) =>
    createAuthorizationSubject(Subjects.CleanupEvent, request.eventAuthorization!.cleanupEvent);
  const sessionResource = (request: Request) =>
    createAuthorizationSubject(Subjects.EventSession, {
      id: request.params.sessionId ?? "event-session",
      cleanupEventId: request.eventAuthorization!.cleanupEvent.id,
      cleanupEvent: { organizationId: request.eventAuthorization!.cleanupEvent.organizationId },
    });
  const noteResource = (request: Request) =>
    createAuthorizationSubject(Subjects.EventNote, {
      id: "event-note",
      cleanupEventId: request.eventAuthorization!.cleanupEvent.id,
      cleanupEvent: { organizationId: request.eventAuthorization!.cleanupEvent.organizationId },
    });
  const evidenceResource = (request: Request) =>
    createAuthorizationSubject(Subjects.EventEvidence, {
      id: "event-evidence",
      cleanupEventId: request.eventAuthorization!.cleanupEvent.id,
      cleanupEvent: { organizationId: request.eventAuthorization!.cleanupEvent.organizationId },
    });

  router.get(
    "/organizations/:organizationId/events/:eventId/operations",
    ...eventOperationsRoute,
    authorizeResource(Actions.Read, eventResource),
    getEventOperationsController(deps),
  );

  router.post(
    "/organizations/:organizationId/events/:eventId/notes",
    ...eventOperationsRoute,
    authorizeResource(Actions.AddNote, noteResource),
    addEventNoteController(deps),
  );

  router.post(
    "/organizations/:organizationId/events/:eventId/evidence/upload-intents",
    ...eventOperationsRoute,
    authorizeResource(Actions.UploadEvidence, evidenceResource),
    createEventEvidenceUploadIntentsController(deps),
  );

  router.post(
    "/organizations/:organizationId/events/:eventId/evidence",
    ...eventOperationsRoute,
    authorizeResource(Actions.UploadEvidence, evidenceResource),
    registerEventEvidenceController(deps),
  );

  router.patch(
    "/organizations/:organizationId/events/:eventId/sessions/:sessionId/status",
    ...eventOperationsRoute,
    authorizeResource(Actions.Transition, sessionResource),
    transitionSessionController(deps),
  );

  router.post(
    "/organizations/:organizationId/events/:eventId/transitions",
    ...eventOperationsRoute,
    authorizeResource(Actions.Transition, eventResource),
    transitionEventController(deps),
  );

  router.get(
    "/organizations/:organizationId/events/:eventId/completion-readiness",
    ...eventOperationsRoute,
    authorizeResource(Actions.Complete, eventResource),
    getCompletionReadinessController(deps),
  );

  router.post(
    "/organizations/:organizationId/events/:eventId/cancel",
    ...eventOperationsRoute,
    authorizeResource(Actions.Cancel, eventResource),
    cancelEventController(deps),
  );

  router.post(
    "/organizations/:organizationId/events/:eventId/complete",
    ...eventOperationsRoute,
    authorizeResource(Actions.Complete, eventResource),
    completeEventController(deps),
  );

  router.post(
    "/organizations/:organizationId/events/drafts",
    ...tenantRoute,
    authorize(Actions.Create, Subjects.CleanupEvent),
    createDraftController(deps),
  );

  router.get(
    "/organizations/:organizationId/events/:eventId/participants",
    ...eventOperationsRoute,
    authorizeResource(Actions.Read, participantResource),
    listEventParticipantsController(deps),
  );

  router.post(
    "/organizations/:organizationId/events/:eventId/allocations",
    ...eventOperationsRoute,
    authorizeResource(Actions.Allocate, allocationResource),
    allocateParticipantController(deps),
  );

  router.patch(
    "/organizations/:organizationId/events/:eventId/allocations/:allocationId",
    ...eventOperationsRoute,
    authorizeResource(Actions.Allocate, allocationResource),
    reallocateParticipantController(deps),
  );

  router.post(
    "/organizations/:organizationId/events/:eventId/allocations/:allocationId/remove",
    ...eventOperationsRoute,
    authorizeResource(Actions.Allocate, allocationResource),
    removeAllocationController(deps),
  );

  router.patch(
    "/organizations/:organizationId/events/:eventId/allocations/:allocationId/attendance",
    ...eventOperationsRoute,
    authorizeResource(Actions.RecordAttendance, allocationResource),
    recordAttendanceController(deps),
  );

  router.post(
    "/organizations/:organizationId/events/:eventId/participants/:participantId/remove",
    ...eventOperationsRoute,
    authorizeResource(Actions.RemoveParticipant, participantResource),
    removeParticipantController(deps),
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
    ...eventOperationsRoute,
    authorizeResource(Actions.Read, (request) =>
      createAuthorizationSubject(Subjects.CleanupEvent, request.eventAuthorization!.cleanupEvent)),
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
    "/events/:eventId/participant-updates",
    ...publicRoute,
    authorize(Actions.Read, Subjects.CleanupEvent),
    getParticipantEventUpdatesController(deps),
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
