import type { NotificationType } from "../../generated/prisma/enums.js";
import type { PushDevicePlatform } from "../../generated/prisma/enums.js";

export type SafeNotificationData = {
  achievementId?: string;
  eventId?: string;
  incidentId?: string;
  membershipRequestId?: string;
  organizationId?: string;
  startsAt?: string;
  status?: string;
};

export type NotificationDto = {
  id: string;
  organizationId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data: SafeNotificationData | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationCursor = {
  createdAt: Date;
  id: string;
};

export type ListNotificationsCommand = {
  userId: string;
  limit: number;
  unreadOnly: boolean;
  cursor: NotificationCursor | null;
};

export type NotificationPageDto = {
  items: NotificationDto[];
  nextCursor: string | null;
};

export type MarkAllNotificationsReadDto = {
  markedReadCount: number;
  readAt: string;
};

export type CreateNotificationCommand = {
  userId: string;
  organizationId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data?: SafeNotificationData;
  deduplicationKey?: string;
};

export type RegisterPushDeviceCommand = {
  userId: string;
  installationId: string;
  expoPushToken: string;
  platform: PushDevicePlatform;
  deviceName?: string;
  appVersion?: string;
};

export type PushDeviceDto = {
  installationId: string;
  platform: PushDevicePlatform;
  deviceName: string | null;
  appVersion: string | null;
  isActive: boolean;
  registeredAt: string;
  lastSeenAt: string;
};
