import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { z } from "zod";

import type { AuthorizationDependencies } from "../authorization/authorization.types.js";
import { ApplicationError } from "../errors/applicationError.js";

const cleanupEventIdSchema = z.uuid();

export function createEventAuthorizationMiddleware(
  dependencies: AuthorizationDependencies,
  cleanupEventIdParameter = "eventId",
) {
  return async function resolveEventAuthorization(
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenant = request.tenant;

      if (!tenant) {
        throw new ApplicationError(
          500,
          "TENANT_CONTEXT_MISSING",
          "Organization context was not initialized.",
        );
      }

      const parsedCleanupEventId =
        cleanupEventIdSchema.safeParse(
          request.params[cleanupEventIdParameter],
        );

      if (!parsedCleanupEventId.success) {
        throw new ApplicationError(
          400,
          "CLEANUP_EVENT_ID_INVALID",
          "A valid cleanup event ID is required.",
        );
      }

      const eventAuthorization =
        await dependencies.findEventAuthorizationContext(
          tenant.organization.id,
          tenant.membership.id,
          parsedCleanupEventId.data,
        );

      if (!eventAuthorization) {
        throw new ApplicationError(
          404,
          "CLEANUP_EVENT_NOT_FOUND",
          "The cleanup event was not found in this organization.",
        );
      }

      request.eventAuthorization =
        eventAuthorization;

      next();
    } catch (error) {
      next(error);
    }
  };
}
