import { ApplicationError } from "../../../errors/applicationError.js";

import type { NotificationWriteDependencies } from "../notification.dependencies.js";
import {
  sanitizeNotificationData,
  toNotificationDto,
} from "../notification.mapper.js";
import type {
  CreateNotificationCommand,
  NotificationDto,
} from "../notification.types.js";
import { createNotificationRecord } from "../repositories/notification.repository.js";

export async function createNotification(
  dependencies: NotificationWriteDependencies,
  command: CreateNotificationCommand,
): Promise<NotificationDto> {
  const title = command.title.trim();
  const message = command.message.trim();

  if (!title || !message) {
    throw new ApplicationError(
      500,
      "NOTIFICATION_CONTENT_INVALID",
      "Notification title and message are required.",
    );
  }

  const notification = await createNotificationRecord(
    dependencies.prisma,
    {
      ...command,
      title,
      message,
      data:
        sanitizeNotificationData(command.data) ??
        undefined,
    },
  );

  return toNotificationDto(notification);
}
