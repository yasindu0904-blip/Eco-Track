import type {
  NextFunction,
  Request,
  Response,
} from "express";

import type { NotificationDependencies } from "../notification.dependencies.js";
import { getUnreadNotificationCount } from "../services/getUnreadNotificationCount.service.js";

export function getUnreadNotificationCountController(
  dependencies: NotificationDependencies,
) {
  return async function handleGetUnreadNotificationCount(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const unreadCount =
        await getUnreadNotificationCount(
          dependencies,
          request.authentication.profile.id,
        );

      response.status(200).json({
        data: {
          unreadCount,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
