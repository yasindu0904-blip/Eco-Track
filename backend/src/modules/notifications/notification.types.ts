import type { NotificationType } from "../../generated/prisma/enums.js";

export type SafeNotificationData = {
  achievementId?: string;
  eventId?: string;
  incidentId?: string;
  membershipRequestId?: string;
  organizationId?: string;
  sessionId?: string;
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
};
