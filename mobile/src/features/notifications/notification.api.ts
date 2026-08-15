import { apiRequest } from "../../api/apiClient";
import type { NotificationItem, NotificationPage } from "./notification.types";

export async function listNotifications(
  accessToken: string,
  options: { cursor?: string; unreadOnly?: boolean } = {},
): Promise<NotificationPage> {
  const query = new URLSearchParams({
    limit: "20",
    unreadOnly: String(options.unreadOnly ?? false),
  });
  if (options.cursor) query.set("cursor", options.cursor);
  return (await apiRequest<{ data: NotificationPage }>(
    `/notifications?${query.toString()}`,
    { accessToken },
  )).data;
}

export async function getUnreadNotificationCount(accessToken: string): Promise<number> {
  return (await apiRequest<{ data: { unreadCount: number } }>(
    "/notifications/unread-count",
    { accessToken },
  )).data.unreadCount;
}

export async function markNotificationRead(
  accessToken: string,
  notificationId: string,
): Promise<NotificationItem> {
  return (await apiRequest<{ data: NotificationItem }>(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PATCH", accessToken },
  )).data;
}

export async function markAllNotificationsRead(
  accessToken: string,
): Promise<{ markedReadCount: number; readAt: string }> {
  return (await apiRequest<{ data: { markedReadCount: number; readAt: string } }>(
    "/notifications/read-all",
    { method: "PATCH", accessToken },
  )).data;
}
