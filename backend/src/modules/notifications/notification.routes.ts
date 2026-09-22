import {
  Router,
  type Router as ExpressRouter,
} from "express";

import { Actions } from "../../authorization/actions.js";
import { Subjects } from "../../authorization/subjects.js";
import { abilityMiddleware } from "../../middleware/ability.middleware.js";
import { createAuthenticationMiddleware } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { requireCompletedProfile } from "../../middleware/requireCompletedProfile.middleware.js";
import { createRedisRateLimit } from "../../middleware/redisRateLimit.middleware.js";
import { requireActiveSuperAdmin } from "../../middleware/requireSuperAdmin.middleware.js";
import { notificationWorkerHealth } from "../../config/redisRuntime.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";

import { getUnreadNotificationCountController } from "./controllers/getUnreadNotificationCount.controller.js";
import { deactivatePushDeviceController } from "./controllers/deactivatePushDevice.controller.js";
import { listNotificationsController } from "./controllers/listNotifications.controller.js";
import { markAllNotificationsReadController } from "./controllers/markAllNotificationsRead.controller.js";
import { markNotificationReadController } from "./controllers/markNotificationRead.controller.js";
import { registerPushDeviceController } from "./controllers/registerPushDevice.controller.js";
import type { NotificationDependencies } from "./notification.dependencies.js";

export function createNotificationRouter(
  authenticationDependencies: AuthenticationDependencies,
  notificationDependencies: NotificationDependencies,
): ExpressRouter {
  const router = Router();
  const authenticate = createAuthenticationMiddleware(
    authenticationDependencies,
  );
  const readOwnNotification = authorize(
    Actions.ReadOwn,
    Subjects.Notification,
  );
  const markOwnNotificationRead = authorize(
    Actions.MarkRead,
    Subjects.Notification,
  );

  router.get("/super-admin/notification-worker", authenticate, requireCompletedProfile,
    requireActiveSuperAdmin, async (_request, response, next) => {
      try {
        response.status(200).json({ data: await notificationWorkerHealth() });
      } catch (error) {
        next(error);
      }
    });

  router.put(
    "/push-devices/:installationId",
    authenticate,
    requireCompletedProfile,
    ...(notificationDependencies.rateLimit ? [createRedisRateLimit(notificationDependencies.rateLimit, "push-device-register", 30, 60 * 60_000)] : []),
    registerPushDeviceController(notificationDependencies),
  );

  router.delete(
    "/push-devices/:installationId",
    authenticate,
    requireCompletedProfile,
    deactivatePushDeviceController(notificationDependencies),
  );

  router.get(
    "/notifications",
    authenticate,
    requireCompletedProfile,
    abilityMiddleware,
    readOwnNotification,
    listNotificationsController(
      notificationDependencies,
    ),
  );

  router.get(
    "/notifications/unread-count",
    authenticate,
    requireCompletedProfile,
    abilityMiddleware,
    readOwnNotification,
    getUnreadNotificationCountController(
      notificationDependencies,
    ),
  );

  router.patch(
    "/notifications/read-all",
    authenticate,
    requireCompletedProfile,
    abilityMiddleware,
    markOwnNotificationRead,
    markAllNotificationsReadController(
      notificationDependencies,
    ),
  );

  router.patch(
    "/notifications/:notificationId/read",
    authenticate,
    requireCompletedProfile,
    abilityMiddleware,
    markOwnNotificationRead,
    markNotificationReadController(
      notificationDependencies,
    ),
  );

  return router;
}
