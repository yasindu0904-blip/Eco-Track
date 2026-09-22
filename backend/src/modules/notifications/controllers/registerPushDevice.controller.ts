import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../../../errors/applicationError.js";
import type { NotificationDependencies } from "../notification.dependencies.js";
import {
  installationIdSchema,
  registerPushDeviceBodySchema,
} from "../notification.validation.js";
import { registerPushDevice } from "../services/registerPushDevice.service.js";

export function registerPushDeviceController(
  dependencies: NotificationDependencies,
) {
  return async function handleRegisterPushDevice(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const installation = installationIdSchema.safeParse(
        request.params.installationId,
      );
      const body = registerPushDeviceBodySchema.safeParse(request.body);

      if (!installation.success || !body.success) {
        const validationMessage = !installation.success
          ? "A valid installation ID is required."
          : !body.success
            ? body.error.issues[0]?.message ?? "The push device details are invalid."
            : "The push device details are invalid.";

        throw new ApplicationError(
          400,
          "PUSH_DEVICE_INVALID",
          validationMessage,
        );
      }

      const device = await registerPushDevice(dependencies, {
        userId: request.authentication.profile.id,
        installationId: installation.data,
        ...body.data,
      });

      response.status(200).json({ data: device });
    } catch (error) {
      next(error);
    }
  };
}
