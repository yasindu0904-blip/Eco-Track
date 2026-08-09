import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { ApplicationError } from "../errors/applicationError.js";

import type { AuthenticationDependencies } from "../modules/auth/auth.types.js";

const bearerTokenPattern = /^Bearer\s+(\S+)$/i;

export function createAuthenticationMiddleware(
  dependencies: AuthenticationDependencies,
) {
  return async function authenticate(
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authorizationHeader =
        request.header("authorization");

      const tokenMatch =
        authorizationHeader?.match(bearerTokenPattern);

      const accessToken = tokenMatch?.[1];

      if (!accessToken) {
        throw new ApplicationError(
          401,
          "AUTH_TOKEN_MISSING",
          "A valid Bearer access token is required.",
        );
      }

      const identity =
        await dependencies.verifyAccessToken(accessToken);

      if (!identity) {
        throw new ApplicationError(
          401,
          "AUTH_TOKEN_INVALID",
          "The access token is invalid or expired.",
        );
      }

      const profile =
        await dependencies.provisionOrSynchronizeProfile(
          identity,
        );

      if (profile.accountStatus !== "ACTIVE") {
        throw new ApplicationError(
          403,
          "ACCOUNT_INACTIVE",
          "This EcoTrack account is not active.",
        );
      }

      request.authentication = {
        authUserId: identity.authUserId,
        profile,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}