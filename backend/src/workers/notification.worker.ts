import { Worker } from "bullmq";
import { Expo, type ExpoPushErrorReceipt } from "expo-server-sdk";

import { env } from "../config/env.js";
import { redisWorkerConnection } from "../config/redis.js";
import { writeNotificationHeartbeat, closeRedisRuntime } from "../config/redisRuntime.js";
import { prisma } from "../database/prisma.js";
import { NotificationDeliveryStatus } from "../generated/prisma/enums.js";
import {
  createNotificationQueue,
  notificationQueueName,
  type NotificationQueueJob,
} from "../queues/notification.queue.js";
import { sanitizeNotificationData } from "../modules/notifications/notification.mapper.js";
import {
  claimDeliveryForQueue,
  deactivateInvalidDeliveryDevice,
  getDeliveryDetail,
  listDispatchableDeliveryIds,
  listDueReceiptDeliveryIds,
  markDeliveryFailed,
  markDeliveryProviderAccepted,
  markDeliveryReceiptPending,
  markDeliveryRetryPending,
  markReceiptChecked,
  releaseQueuedDelivery,
  startDeliveryAttempt,
} from "../modules/notifications/repositories/notificationDelivery.repository.js";

const RECEIPT_DELAY_MS = 15 * 60 * 1_000;
const RECEIPT_RECHECK_MS = 5 * 60 * 1_000;
const QUEUED_STALE_MS = 2 * 60 * 1_000;
const RECEIPT_EXPIRY_MS = 23 * 60 * 60 * 1_000;

const queue = createNotificationQueue();
const expo = new Expo(
  env.EXPO_ACCESS_TOKEN
    ? { accessToken: env.EXPO_ACCESS_TOKEN }
    : undefined,
);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown notification delivery error.";
}

function retryTime(attemptCount: number): Date {
  const delaySeconds = Math.min(3_600, 30 * (2 ** Math.max(0, attemptCount - 1)));
  return new Date(Date.now() + delaySeconds * 1_000);
}

function isPermanentExpoError(code: string | undefined): boolean {
  return code === "DeveloperError"
    || code === "InvalidCredentials"
    || code === "MessageTooBig";
}

async function failAndDeactivateDevice(
  deliveryId: string,
  deviceId: string,
  message: string,
  checkedAt?: Date,
): Promise<void> {
  await prisma.$transaction([
    prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationDeliveryStatus.FAILED,
        nextRetryAt: null,
        receiptCheckedAt: checkedAt,
        lastErrorCode: "DeviceNotRegistered",
        lastErrorMessage: message.slice(0, 500),
      },
    }),
    prisma.userDevice.update({
      where: { id: deviceId },
      data: {
        expoPushToken: null,
        isActive: false,
        deactivatedAt: new Date(),
      },
    }),
  ]);
}

async function handleExpoFailure(
  deliveryId: string,
  deviceId: string,
  attemptCount: number,
  failure: ExpoPushErrorReceipt,
  checkedAt?: Date,
): Promise<void> {
  const code = failure.details?.error ?? "EXPO_DELIVERY_ERROR";

  if (code === "DeviceNotRegistered") {
    await failAndDeactivateDevice(
      deliveryId,
      deviceId,
      failure.message,
      checkedAt,
    );
    return;
  }

  if (isPermanentExpoError(code) || attemptCount >= env.NOTIFICATION_MAX_ATTEMPTS) {
    await markDeliveryFailed(
      prisma,
      deliveryId,
      code,
      failure.message,
      checkedAt,
    );
    return;
  }

  await markDeliveryRetryPending(
    prisma,
    deliveryId,
    retryTime(attemptCount),
    code,
    failure.message,
  );
}

async function processSend(deliveryId: string): Promise<void> {
  const delivery = await getDeliveryDetail(prisma, deliveryId);

  if (!delivery || delivery.status !== NotificationDeliveryStatus.QUEUED) {
    return;
  }

  const pushToken = delivery.device.expoPushToken;
  if (!delivery.device.isActive || !pushToken || !Expo.isExpoPushToken(pushToken)) {
    await markDeliveryFailed(
      prisma,
      delivery.id,
      "PUSH_TOKEN_INVALID",
      "The registered Expo push token is unavailable or invalid.",
    );
    if (delivery.device.isActive) {
      await deactivateInvalidDeliveryDevice(prisma, delivery.device.id);
    }
    return;
  }

  const { attemptCount } = await startDeliveryAttempt(prisma, delivery.id);
  const safeData = sanitizeNotificationData(delivery.notification.data) ?? {};

  try {
    const [ticket] = await expo.sendPushNotificationsAsync([{
      to: pushToken,
      title: delivery.notification.title,
      body: delivery.notification.message,
      sound: "default",
      priority: "high",
      channelId: "ecotrack-updates-v2",
      data: {
        notificationId: delivery.notification.id,
        type: delivery.notification.type,
        ...(delivery.notification.organizationId
          ? { organizationId: delivery.notification.organizationId }
          : {}),
        ...safeData,
      },
    }]);

    if (!ticket) {
      throw new Error("Expo did not return a push ticket.");
    }

    if (ticket.status === "error") {
      await handleExpoFailure(
        delivery.id,
        delivery.device.id,
        attemptCount,
        ticket,
      );
      return;
    }

    const sentAt = new Date();
    await markDeliveryReceiptPending(prisma, delivery.id, ticket.id, sentAt);
    try {
      await queue.add(
        "check-receipt",
        { kind: "receipt", deliveryId: delivery.id },
        {
          delay: RECEIPT_DELAY_MS,
          jobId: `receipt-${delivery.id}-${ticket.id}`,
        },
      );
    } catch (queueError) {
      console.error(
        `Receipt scheduling failed for ${delivery.id}; durable recovery will retry it:`,
        errorMessage(queueError),
      );
    }
  } catch (error) {
    if (attemptCount >= env.NOTIFICATION_MAX_ATTEMPTS) {
      await markDeliveryFailed(
        prisma,
        delivery.id,
        "EXPO_REQUEST_FAILED",
        errorMessage(error),
      );
      return;
    }

    await markDeliveryRetryPending(
      prisma,
      delivery.id,
      retryTime(attemptCount),
      "EXPO_REQUEST_FAILED",
      errorMessage(error),
    );
  }
}

async function processReceipt(deliveryId: string): Promise<void> {
  const delivery = await getDeliveryDetail(prisma, deliveryId);

  if (
    !delivery
    || delivery.status !== NotificationDeliveryStatus.RECEIPT_PENDING
    || !delivery.expoTicketId
    || !delivery.sentAt
  ) {
    return;
  }

  const checkedAt = new Date();

  if (checkedAt.getTime() - delivery.sentAt.getTime() >= RECEIPT_EXPIRY_MS) {
    if (delivery.attemptCount >= env.NOTIFICATION_MAX_ATTEMPTS) {
      await markDeliveryFailed(
        prisma,
        delivery.id,
        "EXPO_RECEIPT_EXPIRED",
        "Expo did not return a receipt before it expired.",
        checkedAt,
      );
    } else {
      await markDeliveryRetryPending(
        prisma,
        delivery.id,
        retryTime(delivery.attemptCount),
        "EXPO_RECEIPT_EXPIRED",
        "Expo did not return a receipt before it expired.",
      );
    }
    return;
  }

  try {
    const receipts = await expo.getPushNotificationReceiptsAsync([
      delivery.expoTicketId,
    ]);
    const receipt = receipts[delivery.expoTicketId];

    if (!receipt) {
      await markReceiptChecked(prisma, delivery.id, checkedAt);
      return;
    }

    if (receipt.status === "ok") {
      await markDeliveryProviderAccepted(prisma, delivery.id, checkedAt);
      return;
    }

    await handleExpoFailure(
      delivery.id,
      delivery.device.id,
      delivery.attemptCount,
      receipt,
      checkedAt,
    );
  } catch (error) {
    await markReceiptChecked(prisma, delivery.id, checkedAt);
    console.error(`Expo receipt check failed for ${delivery.id}:`, errorMessage(error));
  }
}

const worker = new Worker<NotificationQueueJob>(
  notificationQueueName,
  async (job) => {
    if (job.data.kind === "send") {
      await processSend(job.data.deliveryId);
      return;
    }

    await processReceipt(job.data.deliveryId);
  },
  {
    connection: redisWorkerConnection,
    concurrency: 6,
  },
);

worker.on("error", (error) => {
  console.error("Notification worker Redis error:", error);
});

worker.on("failed", (job, error) => {
  console.error(`Notification job ${job?.id ?? "unknown"} failed:`, error);
});

let dispatchRunning = false;

async function dispatchDurableWork(): Promise<void> {
  if (dispatchRunning) return;
  dispatchRunning = true;

  try {
    const now = new Date();
    const staleQueuedBefore = new Date(now.getTime() - QUEUED_STALE_MS);
    const deliveryIds = await listDispatchableDeliveryIds(
      prisma,
      now,
      staleQueuedBefore,
    );

    for (const deliveryId of deliveryIds) {
      const claimed = await claimDeliveryForQueue(
        prisma,
        deliveryId,
        now,
        staleQueuedBefore,
      );
      if (!claimed) continue;

      try {
        await queue.add(
          "send",
          { kind: "send", deliveryId },
          { jobId: `send-${deliveryId}` },
        );
      } catch (error) {
        await releaseQueuedDelivery(
          prisma,
          deliveryId,
          new Date(Date.now() + env.NOTIFICATION_DISPATCH_INTERVAL_MS),
          errorMessage(error),
        );
      }
    }

    const receiptIds = await listDueReceiptDeliveryIds(
      prisma,
      new Date(now.getTime() - RECEIPT_DELAY_MS),
      new Date(now.getTime() - RECEIPT_RECHECK_MS),
    );

    const receiptBucket = Math.floor(now.getTime() / RECEIPT_RECHECK_MS);
    for (const deliveryId of receiptIds) {
      await queue.add(
        "check-receipt",
        { kind: "receipt", deliveryId },
        { jobId: `receipt-${deliveryId}-${receiptBucket}` },
      );
    }
  } finally {
    dispatchRunning = false;
  }
}

const dispatchInterval = setInterval(() => {
  void dispatchDurableWork().catch((error: unknown) => {
    console.error("Notification delivery dispatch failed:", errorMessage(error));
  });
}, env.NOTIFICATION_DISPATCH_INTERVAL_MS);
dispatchInterval.unref();

void dispatchDurableWork().catch((error: unknown) => {
  console.error("Initial notification delivery dispatch failed:", errorMessage(error));
});

console.log("EcoTrack notification worker started.");

const heartbeatInterval = setInterval(() => {
  void writeNotificationHeartbeat().catch(() => undefined);
}, 15_000);
heartbeatInterval.unref();
void writeNotificationHeartbeat().catch(() => undefined);

let shutdownStarted = false;
async function shutdown(signal: string): Promise<void> {
  if (shutdownStarted) return;
  shutdownStarted = true;
  clearInterval(dispatchInterval);
  clearInterval(heartbeatInterval);
  console.log(`${signal} received. Shutting down notification worker.`);

  try {
    await worker.close();
    await queue.close();
    await closeRedisRuntime();
    await prisma.$disconnect();
  } catch (error) {
    console.error("Notification worker shutdown failed:", error);
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => { void shutdown("SIGINT"); });
process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
