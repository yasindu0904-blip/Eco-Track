import type {
  NextFunction,
  Request,
  Response,
} from "express";

import type { Action } from "../authorization/actions.js";
import type {
  Subject,
  SubjectName,
} from "../authorization/subjects.js";
import { ApplicationError } from "../errors/applicationError.js";

export function authorize(
  action: Action,
  subject: SubjectName,
) {
  return function authorizeRequest(
    request: Request,
    _response: Response,
    next: NextFunction,
  ): void {
    const ability = request.ability;

    if (!ability) {
      next(
        new ApplicationError(
          500,
          "AUTHORIZATION_CONTEXT_MISSING",
          "Authorization context was not initialized.",
        ),
      );

      return;
    }

    if (!ability.can(action, subject)) {
      next(
        new ApplicationError(
          403,
          "AUTHORIZATION_DENIED",
          "You do not have permission to perform this action.",
        ),
      );

      return;
    }

    next();
  };
}

export function authorizeResource(
  action: Action,
  resolveSubject: (request: Request) => Subject,
) {
  return function authorizeResolvedResource(
    request: Request,
    _response: Response,
    next: NextFunction,
  ): void {
    try {
      const ability = request.ability;

      if (!ability) {
        throw new ApplicationError(
          500,
          "AUTHORIZATION_CONTEXT_MISSING",
          "Authorization context was not initialized.",
        );
      }

      const resource = resolveSubject(request);

      if (!ability.can(action, resource)) {
        throw new ApplicationError(
          403,
          "AUTHORIZATION_DENIED",
          "You do not have permission to perform this action.",
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
