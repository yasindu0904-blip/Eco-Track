import type {
  NextFunction,
  Request,
  Response,
} from "express";

import type { NotificationDependencies } from "../notification.dependencies.js";
import { markAllNotificationsRead } from "../services/markAllNotificationsRead.service.js";

export function markAllNotificationsReadController(
  dependencies: NotificationDependencies,
) {
  return async function handleMarkAllNotificationsRead(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await markAllNotificationsRead(
        dependencies,
        request.authentication.profile.id,
      );

      response.status(200).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
