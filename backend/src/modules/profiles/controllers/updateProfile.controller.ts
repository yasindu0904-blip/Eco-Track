import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../../../errors/applicationError.js";
import { updateProfileSchema } from "../profile.validation.js";
import { updateProfile } from "../services/updateProfile.service.js";

export async function updateProfileController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateProfileSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ApplicationError(
        400,
        "PROFILE_INPUT_INVALID",
        parsed.error.issues[0]?.message ?? "Profile input is invalid.",
      );
    }

    response.status(200).json({
      data: await updateProfile(
        request.authentication.profile.id,
        parsed.data,
      ),
    });
  } catch (error) {
    next(error);
  }
}
