import type { NotificationDependencies } from "../notification.dependencies.js";
import type { MarkAllNotificationsReadDto } from "../notification.types.js";
import { markAllNotificationRecordsRead } from "../repositories/notification.repository.js";

export async function markAllNotificationsRead(
  dependencies: NotificationDependencies,
  userId: string,
): Promise<MarkAllNotificationsReadDto> {
  const readAt = new Date();
  const markedReadCount =
    await markAllNotificationRecordsRead(
      dependencies.prisma,
      userId,
      readAt,
    );

  return {
    markedReadCount,
    readAt: readAt.toISOString(),
  };
}
