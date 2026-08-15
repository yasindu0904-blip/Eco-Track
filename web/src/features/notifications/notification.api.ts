import { apiRequest } from "../../api/apiClient";

import type {
  MarkAllReadResponse,
  NotificationItem,
  NotificationPage,
  NotificationPageResponse,
  NotificationResponse,
  UnreadCountResponse,
} from "./notification.types";

export async function listNotifications(
  accessToken: string,
  options: {
    cursor?: string;
    limit?: number;
    unreadOnly?: boolean;
  } = {},
): Promise<NotificationPage> {
  const query = new URLSearchParams({
    limit: String(options.limit ?? 20),
    unreadOnly: String(options.unreadOnly ?? false),
  });

  if (options.cursor) {
    query.set("cursor", options.cursor);
  }

  return (
    await apiRequest<NotificationPageResponse>(
      `/notifications?${query.toString()}`,
      { accessToken },
    )
  ).data;
}

export async function getUnreadNotificationCount(
  accessToken: string,
): Promise<number> {
  return (
    await apiRequest<UnreadCountResponse>(
      "/notifications/unread-count",
      { accessToken },
    )
  ).data.unreadCount;
}

export async function markNotificationRead(
  accessToken: string,
  notificationId: string,
): Promise<NotificationItem> {
  return (
    await apiRequest<NotificationResponse>(
      `/notifications/${encodeURIComponent(notificationId)}/read`,
      {
        method: "PATCH",
        accessToken,
      },
    )
  ).data;
}

export async function markAllNotificationsRead(
  accessToken: string,
): Promise<MarkAllReadResponse["data"]> {
  return (
    await apiRequest<MarkAllReadResponse>(
      "/notifications/read-all",
      {
        method: "PATCH",
        accessToken,
      },
    )
  ).data;
}
