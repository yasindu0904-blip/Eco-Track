import cors from "cors";
import express, {
  type Express,
} from "express";
import helmet from "helmet";

import type { AuthorizationDependencies } from "./authorization/authorization.types.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/notFound.middleware.js";

import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createAdministrativeAreaRouter } from "./modules/administrativeAreas/administrativeArea.routes.js";
import type { CleanupWorkflowDependencies } from "./modules/cleanupWorkflows/cleanupWorkflow.dependencies.js";
import { createCleanupWorkflowRouter } from "./modules/cleanupWorkflows/cleanupWorkflow.routes.js";
import type { MembershipAdministrationDependencies } from "./modules/memberships/administration/membershipAdministration.dependencies.js";
import { createMembershipAdministrationRouter } from "./modules/memberships/administration/membershipAdministration.routes.js";
import { createNotificationRouter } from "./modules/notifications/notification.routes.js";
import { createMembershipSelfServiceRouter } from "./modules/memberships/selfService/membershipSelfService.routes.js";
import { createIncidentRouter } from "./modules/incidents/incident.routes.js";
import { createOrganizationApplicationRouter } from "./modules/organizations/application/application.routes.js";
import { createOrganizationReviewRouter } from "./modules/organizations/review/organizationReview.routes.js";
import { createProfileRouter } from "./modules/profiles/profile.routes.js";
import { createRewardRouter } from "./modules/rewards/reward.routes.js";
import { createCleanupEventRouter } from "./modules/cleanupEvents/cleanupEvents.routes.js";

import type { AuthenticationDependencies } from "./modules/auth/auth.types.js";
import type { NotificationDependencies } from "./modules/notifications/notification.dependencies.js";
import type { MembershipSelfServiceDependencies } from "./modules/memberships/selfService/membershipSelfService.dependencies.js";
import type { IncidentDependencies } from "./modules/incidents/incident.dependencies.js";
import type { OrganizationApplicationDependencies } from "./modules/organizations/application/application.dependencies.js";
import type { RewardDependencies } from "./modules/rewards/reward.dependencies.js";
import type { CleanupEventDependencies } from "./modules/cleanupEvents/cleanupEvent.dependencies.js";
import type { DashboardDependencies } from "./modules/dashboards/dashboard.types.js";
import { createDashboardRouter } from "./modules/dashboards/dashboard.routes.js";

type CreateAppOptions = {
  webOrigin?: string;
  authorizationDependencies?: AuthorizationDependencies;
  cleanupWorkflowDependencies?: CleanupWorkflowDependencies;
  membershipAdministrationDependencies?: MembershipAdministrationDependencies;
  notificationDependencies?: NotificationDependencies;
  membershipSelfServiceDependencies?: MembershipSelfServiceDependencies;
  incidentDependencies?: IncidentDependencies;
  organizationApplicationDependencies?: OrganizationApplicationDependencies;
  rewardDependencies?: RewardDependencies;
  cleanupEventDependencies?: CleanupEventDependencies;
  dashboardDependencies?: DashboardDependencies;
};

export function createApp(
  authenticationDependencies: AuthenticationDependencies,
  options: CreateAppOptions = {},
): Express {
  const app = express();

  app.disable("x-powered-by");

  app.use(helmet());

  app.use(
    cors({
      origin:
        options.webOrigin ??
        "http://localhost:5173",
    }),
  );

  app.use(
    express.json({
      limit: "1mb",
    }),
  );

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "ecotrack-backend",
    });
  });

  app.use(
    "/api/v1",
    createAuthRouter(authenticationDependencies),
  );

  app.use(
    "/api/v1",
    createProfileRouter(authenticationDependencies),
  );

  if (options.dashboardDependencies) {
    app.use(
      "/api/v1",
      createDashboardRouter(
        authenticationDependencies,
        options.dashboardDependencies,
      ),
    );
  }

  if (options.notificationDependencies) {
    app.use(
      "/api/v1",
      createNotificationRouter(
        authenticationDependencies,
        options.notificationDependencies,
      ),
    );
  }

  if (options.membershipSelfServiceDependencies) {
    app.use(
      "/api/v1",
      createMembershipSelfServiceRouter(
        authenticationDependencies,
        options.membershipSelfServiceDependencies,
      ),
    );
  }

  if (options.rewardDependencies) {
    app.use(
      "/api/v1",
      createRewardRouter(
        authenticationDependencies,
        options.rewardDependencies,
      ),
    );
  }

  if (options.incidentDependencies) {
    app.use(
      "/api/v1",
      createIncidentRouter(
        authenticationDependencies,
        options.incidentDependencies,
      ),
    );
  }

  if (
    options.authorizationDependencies &&
    options.cleanupWorkflowDependencies
  ) {
    app.use(
      "/api/v1",
      createCleanupWorkflowRouter(
        authenticationDependencies,
        options.authorizationDependencies,
        options.cleanupWorkflowDependencies,
      ),
    );
  }

  if (options.cleanupEventDependencies) {
    app.use(
      "/api/v1",
      createCleanupEventRouter(authenticationDependencies, options.cleanupEventDependencies),
    );
  }

  if (
    options.authorizationDependencies &&
    options.membershipAdministrationDependencies
  ) {
    app.use(
      "/api/v1",
      createMembershipAdministrationRouter(
        authenticationDependencies,
        options.authorizationDependencies,
        options.membershipAdministrationDependencies,
      ),
    );
  }

  if (options.organizationApplicationDependencies) {
    app.use(
      "/api/v1",
      createAdministrativeAreaRouter(
        authenticationDependencies,
        options.organizationApplicationDependencies,
      ),
    );

    app.use(
      "/api/v1",
      createOrganizationApplicationRouter(
        authenticationDependencies,
        options.organizationApplicationDependencies,
      ),
    );

    app.use(
      "/api/v1",
      createOrganizationReviewRouter(
        authenticationDependencies,
        options.organizationApplicationDependencies,
      ),
    );
  }

  app.use(notFoundMiddleware);

  app.use(errorMiddleware);

  return app;
}
