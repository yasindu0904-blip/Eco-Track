import type { NotificationDependencies } from "../notification.dependencies.js";
import { countUnreadNotificationRecords } from "../repositories/notification.repository.js";

export async function getUnreadNotificationCount(
  dependencies: NotificationDependencies,
  userId: string,
): Promise<number> {
  return countUnreadNotificationRecords(
    dependencies.prisma,
    userId,
  );
}
