import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { z } from "zod";

import type { AuthorizationDependencies } from "../authorization/authorization.types.js";
import { ApplicationError } from "../errors/applicationError.js";

const organizationIdSchema = z.uuid();

export function createTenantMiddleware(
  dependencies: AuthorizationDependencies,
  organizationIdParameter = "organizationId",
) {
  return async function resolveTenant(
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authentication = request.authentication;

      if (!authentication) {
        throw new ApplicationError(
          401,
          "AUTHENTICATION_REQUIRED",
          "Authentication is required.",
        );
      }

      const parsedOrganizationId =
        organizationIdSchema.safeParse(
          request.params[organizationIdParameter],
        );

      if (!parsedOrganizationId.success) {
        throw new ApplicationError(
          400,
          "ORGANIZATION_ID_INVALID",
          "A valid organization ID is required.",
        );
      }

      const tenant =
        await dependencies.findActiveTenantContext(
          authentication.profile.id,
          parsedOrganizationId.data,
        );

      if (!tenant) {
        throw new ApplicationError(
          403,
          "ORGANIZATION_ACCESS_DENIED",
          "You do not have access to this organization.",
        );
      }

      request.tenant = tenant;

      next();
    } catch (error) {
      next(error);
    }
  };
}
