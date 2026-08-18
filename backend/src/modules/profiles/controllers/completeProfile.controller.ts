import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../../../errors/applicationError.js";
import { completeProfileSchema } from "../profile.validation.js";
import { completeProfile } from "../services/completeProfile.service.js";

export async function completeProfileController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = completeProfileSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ApplicationError(
        400,
        "PROFILE_INPUT_INVALID",
        parsed.error.issues[0]?.message ?? "Profile input is invalid.",
      );
    }

    const profile = await completeProfile(
      request.authentication.profile.id,
      parsed.data,
    );

    response.status(200).json({
      data: {
        ...profile,
        activeMemberships:
          request.authentication.profile.activeMemberships ?? [],
      },
    });
  } catch (error) {
    next(error);
  }
}
