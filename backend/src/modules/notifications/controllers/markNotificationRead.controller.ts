import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { ApplicationError } from "../../../errors/applicationError.js";

import type { NotificationDependencies } from "../notification.dependencies.js";
import { markNotificationRead } from "../services/markNotificationRead.service.js";
import { notificationIdSchema } from "../notification.validation.js";

export function markNotificationReadController(
  dependencies: NotificationDependencies,
) {
  return async function handleMarkNotificationRead(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validation = notificationIdSchema.safeParse(
        request.params.notificationId,
      );

      if (!validation.success) {
        throw new ApplicationError(
          400,
          "NOTIFICATION_ID_INVALID",
          "A valid notification ID is required.",
        );
      }

      const notification = await markNotificationRead(
        dependencies,
        request.authentication.profile.id,
        validation.data,
      );

      response.status(200).json({
        data: notification,
      });
    } catch (error) {
      next(error);
    }
  };
}
