import type { PrismaClient } from "../../../generated/prisma/client.js";
import { NotificationDeliveryStatus } from "../../../generated/prisma/enums.js";

const deliveryDetailSelect = {
  id: true,
  status: true,
  attemptCount: true,
  expoTicketId: true,
  sentAt: true,
  device: {
    select: {
      id: true,
      isActive: true,
      expoPushToken: true,
    },
  },
  notification: {
    select: {
      id: true,
      userId: true,
      organizationId: true,
      type: true,
      title: true,
      message: true,
      data: true,
    },
  },
} as const;

export async function listDispatchableDeliveryIds(
  prisma: PrismaClient,
  now: Date,
  staleQueuedBefore: Date,
  take = 100,
): Promise<string[]> {
  const records = await prisma.notificationDelivery.findMany({
    where: {
      device: { isActive: true, expoPushToken: { not: null } },
      OR: [
        { status: NotificationDeliveryStatus.PENDING },
        {
          status: NotificationDeliveryStatus.RETRY_PENDING,
          nextRetryAt: { lte: now },
        },
        {
          status: NotificationDeliveryStatus.QUEUED,
          updatedAt: { lte: staleQueuedBefore },
        },
      ],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take,
    select: { id: true },
  });

  return records.map(({ id }) => id);
}

export async function claimDeliveryForQueue(
  prisma: PrismaClient,
  deliveryId: string,
  now: Date,
  staleQueuedBefore: Date,
): Promise<boolean> {
  const result = await prisma.notificationDelivery.updateMany({
    where: {
      id: deliveryId,
      OR: [
        { status: NotificationDeliveryStatus.PENDING },
        {
          status: NotificationDeliveryStatus.RETRY_PENDING,
          nextRetryAt: { lte: now },
        },
        {
          status: NotificationDeliveryStatus.QUEUED,
          updatedAt: { lte: staleQueuedBefore },
        },
      ],
    },
    data: {
      status: NotificationDeliveryStatus.QUEUED,
      nextRetryAt: null,
    },
  });

  return result.count === 1;
}

export async function releaseQueuedDelivery(
  prisma: PrismaClient,
  deliveryId: string,
  nextRetryAt: Date,
  message: string,
): Promise<void> {
  await prisma.notificationDelivery.updateMany({
    where: { id: deliveryId, status: NotificationDeliveryStatus.QUEUED },
    data: {
      status: NotificationDeliveryStatus.RETRY_PENDING,
      nextRetryAt,
      lastErrorCode: "QUEUE_UNAVAILABLE",
      lastErrorMessage: message.slice(0, 500),
    },
  });
}

export async function listDueReceiptDeliveryIds(
  prisma: PrismaClient,
  receiptReadyBefore: Date,
  receiptRecheckBefore: Date,
  take = 100,
): Promise<string[]> {
  const records = await prisma.notificationDelivery.findMany({
    where: {
      status: NotificationDeliveryStatus.RECEIPT_PENDING,
      sentAt: { lte: receiptReadyBefore },
      OR: [
        { receiptCheckedAt: null },
        { receiptCheckedAt: { lte: receiptRecheckBefore } },
      ],
    },
    orderBy: [{ sentAt: "asc" }, { id: "asc" }],
    take,
    select: { id: true },
  });

  return records.map(({ id }) => id);
}

export async function getDeliveryDetail(
  prisma: PrismaClient,
  deliveryId: string,
) {
  return prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    select: deliveryDetailSelect,
  });
}

export async function startDeliveryAttempt(
  prisma: PrismaClient,
  deliveryId: string,
) {
  return prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      attemptCount: { increment: 1 },
      lastErrorCode: null,
      lastErrorMessage: null,
    },
    select: { attemptCount: true },
  });
}

export async function markDeliveryReceiptPending(
  prisma: PrismaClient,
  deliveryId: string,
  ticketId: string,
  sentAt: Date,
): Promise<void> {
  await prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: NotificationDeliveryStatus.RECEIPT_PENDING,
      expoTicketId: ticketId,
      sentAt,
      receiptCheckedAt: null,
      nextRetryAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });
}

export async function markDeliveryProviderAccepted(
  prisma: PrismaClient,
  deliveryId: string,
  checkedAt: Date,
): Promise<void> {
  await prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: NotificationDeliveryStatus.PROVIDER_ACCEPTED,
      receiptCheckedAt: checkedAt,
      nextRetryAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });
}

export async function markReceiptChecked(
  prisma: PrismaClient,
  deliveryId: string,
  checkedAt: Date,
): Promise<void> {
  await prisma.notificationDelivery.updateMany({
    where: {
      id: deliveryId,
      status: NotificationDeliveryStatus.RECEIPT_PENDING,
    },
    data: { receiptCheckedAt: checkedAt },
  });
}

export async function markDeliveryRetryPending(
  prisma: PrismaClient,
  deliveryId: string,
  nextRetryAt: Date,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  await prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: NotificationDeliveryStatus.RETRY_PENDING,
      nextRetryAt,
      expoTicketId: null,
      sentAt: null,
      receiptCheckedAt: null,
      lastErrorCode: errorCode.slice(0, 100),
      lastErrorMessage: errorMessage.slice(0, 500),
    },
  });
}

export async function markDeliveryFailed(
  prisma: PrismaClient,
  deliveryId: string,
  errorCode: string,
  errorMessage: string,
  checkedAt?: Date,
): Promise<void> {
  await prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: NotificationDeliveryStatus.FAILED,
      nextRetryAt: null,
      receiptCheckedAt: checkedAt,
      lastErrorCode: errorCode.slice(0, 100),
      lastErrorMessage: errorMessage.slice(0, 500),
    },
  });
}

export async function deactivateInvalidDeliveryDevice(
  prisma: PrismaClient,
  deviceId: string,
): Promise<void> {
  await prisma.userDevice.update({
    where: { id: deviceId },
    data: {
      expoPushToken: null,
      isActive: false,
      deactivatedAt: new Date(),
    },
  });
}
