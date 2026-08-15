import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../errors/applicationError.js";

export function requireCompletedProfile(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  const { profile } = request.authentication;

  if (
    !profile.profileCompletedAt ||
    !profile.fullName?.trim() ||
    !profile.phoneNumber?.trim()
  ) {
    next(
      new ApplicationError(
        403,
        "PROFILE_INCOMPLETE",
        "Complete your profile before using this EcoTrack feature.",
      ),
    );
    return;
  }

  next();
}
