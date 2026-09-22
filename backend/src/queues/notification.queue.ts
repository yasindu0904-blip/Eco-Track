import { Queue } from "bullmq";

import { redisWorkerConnection } from "../config/redis.js";

export const notificationQueueName = "ecotrack-notifications";

export type NotificationQueueJob =
  | { kind: "send"; deliveryId: string }
  | { kind: "receipt"; deliveryId: string };

export function createNotificationQueue(): Queue<NotificationQueueJob> {
  return new Queue<NotificationQueueJob>(notificationQueueName, {
    connection: redisWorkerConnection,
    defaultJobOptions: {
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  });
}
