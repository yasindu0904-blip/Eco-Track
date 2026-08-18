import { Router, type Router as ExpressRouter } from "express";

import { Actions } from "../../authorization/actions.js";
import { Subjects } from "../../authorization/subjects.js";
import { abilityMiddleware } from "../../middleware/ability.middleware.js";
import { createAuthenticationMiddleware } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { requireCompletedProfile } from "../../middleware/requireCompletedProfile.middleware.js";
import { createTenantMiddleware } from "../../middleware/tenant.middleware.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import type { IncidentDependencies } from "./incident.dependencies.js";
import {
  createEvidenceUploadIntentsController,
  createIncidentController,
  getMyIncidentController,
  getPublicSafeIncidentController,
  listIncidentCategoriesController,
  listMyIncidentsController,
  listNearbyPublicIncidentsController,
  listOrganizationIncidentsController,
  listOrganizationServiceAreaBoundariesController,
  listPublicIncidentsController,
} from "./controllers/incident.controllers.js";

export function createIncidentRouter(
  authenticationDependencies: AuthenticationDependencies,
  incidentDependencies: IncidentDependencies,
): ExpressRouter {
  const router = Router();
  const authenticate = createAuthenticationMiddleware(authenticationDependencies);
  const protectedRoute = [authenticate, requireCompletedProfile, abilityMiddleware] as const;
  const tenantRoute = [
    authenticate,
    requireCompletedProfile,
    createTenantMiddleware(incidentDependencies.authorization),
    abilityMiddleware,
  ] as const;

  router.get(
    "/incident-categories",
    ...protectedRoute,
    authorize(Actions.Read, Subjects.Incident),
    listIncidentCategoriesController(incidentDependencies),
  );
  router.post(
    "/incidents/evidence/upload-intents",
    ...protectedRoute,
    authorize(Actions.Create, Subjects.Incident),
    createEvidenceUploadIntentsController(incidentDependencies),
  );
  router.post(
    "/incidents",
    ...protectedRoute,
    authorize(Actions.Create, Subjects.Incident),
    createIncidentController(incidentDependencies),
  );
  router.get(
    "/incidents",
    ...protectedRoute,
    authorize(Actions.Read, Subjects.Incident),
    listPublicIncidentsController(incidentDependencies),
  );
  router.get(
    "/incidents/nearby",
    ...protectedRoute,
    authorize(Actions.Read, Subjects.Incident),
    listNearbyPublicIncidentsController(incidentDependencies),
  );
  router.get(
    "/incidents/me",
    ...protectedRoute,
    authorize(Actions.ReadOwn, Subjects.Incident),
    listMyIncidentsController(incidentDependencies),
  );
  router.get(
    "/incidents/me/:id",
    ...protectedRoute,
    authorize(Actions.ReadOwn, Subjects.Incident),
    getMyIncidentController(incidentDependencies),
  );
  router.get(
    "/organizations/:organizationId/incidents",
    ...tenantRoute,
    authorize(Actions.Read, Subjects.Incident),
    listOrganizationIncidentsController(incidentDependencies),
  );
  router.get(
    "/organizations/:organizationId/service-area-boundaries",
    ...tenantRoute,
    authorize(Actions.Read, Subjects.OrganizationServiceArea),
    listOrganizationServiceAreaBoundariesController(incidentDependencies),
  );
  router.get(
    "/incidents/:id",
    ...protectedRoute,
    authorize(Actions.Read, Subjects.Incident),
    getPublicSafeIncidentController(incidentDependencies),
  );

  return router;
}
