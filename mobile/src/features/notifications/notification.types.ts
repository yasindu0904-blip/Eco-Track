export type NotificationType =
  | "INCIDENT_STATUS_CHANGED" | "NEW_INCIDENT_IN_AREA" | "EVENT_PUBLISHED"
  | "EVENT_JOINED" | "SESSION_ALLOCATED" | "EVENT_UPDATED"
  | "EVENT_CANCELLED" | "EVENT_COMPLETED" | "MEMBERSHIP_UPDATED"
  | "ORGANIZATION_REVIEW_UPDATED" | "ACHIEVEMENT_AWARDED" | "GENERAL";

export type NotificationItem = {
  id: string;
  organizationId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, string> | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPage = {
  items: NotificationItem[];
  nextCursor: string | null;
};
