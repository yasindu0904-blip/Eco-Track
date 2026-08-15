import { ApplicationError } from "../../../errors/applicationError.js";

import type { NotificationDependencies } from "../notification.dependencies.js";
import { toNotificationDto } from "../notification.mapper.js";
import type { NotificationDto } from "../notification.types.js";
import { markNotificationReadRecord } from "../repositories/notification.repository.js";

export async function markNotificationRead(
  dependencies: NotificationDependencies,
  userId: string,
  notificationId: string,
): Promise<NotificationDto> {
  const notification =
    await markNotificationReadRecord(
      dependencies.prisma,
      userId,
      notificationId,
      new Date(),
    );

  if (!notification) {
    throw new ApplicationError(
      404,
      "NOTIFICATION_NOT_FOUND",
      "The notification was not found.",
    );
  }

  return toNotificationDto(notification);
}
