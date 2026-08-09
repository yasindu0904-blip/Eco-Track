import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { ApplicationError } from "../errors/applicationError.js";

export function requireActiveSuperAdmin(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  const authentication = request.authentication;

  if (!authentication) {
    next(
      new ApplicationError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication is required.",
      ),
    );

    return;
  }

  const { profile } = authentication;

  if (
    profile.platformRole !== "SUPER_ADMIN" ||
    profile.accountStatus !== "ACTIVE"
  ) {
    next(
      new ApplicationError(
        403,
        "SUPER_ADMIN_REQUIRED",
        "Active Super Admin access is required.",
      ),
    );

    return;
  }

  next();
}