import type { NotificationType } from "../../generated/prisma/enums.js";

import type {
  NotificationDto,
  SafeNotificationData,
} from "./notification.types.js";

const safeNotificationDataKeys = [
  "achievementId",
  "eventId",
  "incidentId",
  "membershipRequestId",
  "organizationId",
  "sessionId",
  "status",
] as const satisfies ReadonlyArray<keyof SafeNotificationData>;

type NotificationRecord = {
  id: string;
  organizationId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
};

export function sanitizeNotificationData(
  data: unknown,
): SafeNotificationData | null {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return null;
  }

  const source = data as Record<string, unknown>;
  const safeData: SafeNotificationData = {};

  for (const key of safeNotificationDataKeys) {
    const value = source[key];

    if (typeof value === "string") {
      safeData[key] = value;
    }
  }

  return Object.keys(safeData).length > 0
    ? safeData
    : null;
}

export function toNotificationDto(
  record: NotificationRecord,
): NotificationDto {
  return {
    id: record.id,
    organizationId: record.organizationId,
    type: record.type,
    title: record.title,
    message: record.message,
    data: sanitizeNotificationData(record.data),
    readAt: record.readAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}
