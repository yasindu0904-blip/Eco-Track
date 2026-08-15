export type NotificationType =
  | "INCIDENT_STATUS_CHANGED"
  | "NEW_INCIDENT_IN_AREA"
  | "EVENT_PUBLISHED"
  | "EVENT_JOINED"
  | "SESSION_ALLOCATED"
  | "EVENT_UPDATED"
  | "EVENT_CANCELLED"
  | "EVENT_COMPLETED"
  | "MEMBERSHIP_UPDATED"
  | "ORGANIZATION_REVIEW_UPDATED"
  | "ACHIEVEMENT_AWARDED"
  | "GENERAL";

export type NotificationData = {
  achievementId?: string;
  eventId?: string;
  incidentId?: string;
  membershipRequestId?: string;
  organizationId?: string;
  sessionId?: string;
  status?: string;
};

export type NotificationItem = {
  id: string;
  organizationId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPage = {
  items: NotificationItem[];
  nextCursor: string | null;
};

export type NotificationPageResponse = {
  data: NotificationPage;
};

export type UnreadCountResponse = {
  data: {
    unreadCount: number;
  };
};

export type NotificationResponse = {
  data: NotificationItem;
};

export type MarkAllReadResponse = {
  data: {
    markedReadCount: number;
    readAt: string;
  };
};
