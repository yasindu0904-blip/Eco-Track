import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../../../errors/applicationError.js";
import type { NotificationDependencies } from "../notification.dependencies.js";
import { installationIdSchema } from "../notification.validation.js";
import { deactivatePushDevice } from "../services/deactivatePushDevice.service.js";

export function deactivatePushDeviceController(
  dependencies: NotificationDependencies,
) {
  return async function handleDeactivatePushDevice(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const installation = installationIdSchema.safeParse(
        request.params.installationId,
      );

      if (!installation.success) {
        throw new ApplicationError(
          400,
          "PUSH_INSTALLATION_ID_INVALID",
          "A valid installation ID is required.",
        );
      }

      await deactivatePushDevice(
        dependencies,
        request.authentication.profile.id,
        installation.data,
      );

      response.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
