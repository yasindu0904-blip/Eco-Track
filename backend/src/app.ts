import cors from "cors";
import express, {
  type Express,
} from "express";
import helmet from "helmet";

import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/notFound.middleware.js";

import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createAdministrativeAreaRouter } from "./modules/administrativeAreas/administrativeArea.routes.js";
import { createOrganizationApplicationRouter } from "./modules/organizations/application/application.routes.js";
import { createOrganizationReviewRouter } from "./modules/organizations/review/organizationReview.routes.js";
import { createProfileRouter } from "./modules/profiles/profile.routes.js";

import type { AuthenticationDependencies } from "./modules/auth/auth.types.js";
import type { OrganizationApplicationDependencies } from "./modules/organizations/application/application.dependencies.js";

type CreateAppOptions = {
  webOrigin?: string;
  organizationApplicationDependencies?: OrganizationApplicationDependencies;
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
