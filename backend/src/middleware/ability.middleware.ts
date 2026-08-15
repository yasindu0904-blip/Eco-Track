import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { buildAbilityForRequest } from "../authorization/ability.factory.js";
import { ApplicationError } from "../errors/applicationError.js";

export function abilityMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  try {
    const authentication = request.authentication;

    if (!authentication) {
      throw new ApplicationError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication is required.",
      );
    }

    request.ability = buildAbilityForRequest({
      profile: authentication.profile,
      tenant: request.tenant,
      eventAuthorization:
        request.eventAuthorization,
    });

    next();
  } catch (error) {
    next(error);
  }
}
