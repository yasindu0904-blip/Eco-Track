import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { ApplicationError } from "../../../errors/applicationError.js";

import type { NotificationDependencies } from "../notification.dependencies.js";
import { listNotifications } from "../services/listNotifications.service.js";
import { listNotificationsQuerySchema } from "../notification.validation.js";

export function listNotificationsController(
  dependencies: NotificationDependencies,
) {
  return async function handleListNotifications(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validation =
        listNotificationsQuerySchema.safeParse(
          request.query,
        );

      if (!validation.success) {
        throw new ApplicationError(
          400,
          "NOTIFICATION_QUERY_INVALID",
          validation.error.issues[0]?.message ??
            "The notification query is invalid.",
        );
      }

      const page = await listNotifications(
        dependencies,
        {
          userId:
            request.authentication.profile.id,
          limit: validation.data.limit,
          unreadOnly:
            validation.data.unreadOnly,
          encodedCursor:
            validation.data.cursor,
        },
      );

      response.status(200).json({
        data: page,
      });
    } catch (error) {
      next(error);
    }
  };
}
