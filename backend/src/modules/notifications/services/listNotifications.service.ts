import { Buffer } from "node:buffer";

import { ApplicationError } from "../../../errors/applicationError.js";

import type { NotificationDependencies } from "../notification.dependencies.js";
import { toNotificationDto } from "../notification.mapper.js";
import type {
  NotificationCursor,
  NotificationPageDto,
} from "../notification.types.js";
import { notificationCursorPayloadSchema } from "../notification.validation.js";
import { listNotificationRecords } from "../repositories/notification.repository.js";

function decodeNotificationCursor(
  encodedCursor: string,
): NotificationCursor {
  try {
    const decoded = Buffer.from(
      encodedCursor,
      "base64url",
    ).toString("utf8");
    const validation =
      notificationCursorPayloadSchema.safeParse(
        JSON.parse(decoded),
      );

    if (!validation.success) {
      throw new Error("Invalid cursor payload.");
    }

    const createdAt = new Date(
      validation.data.createdAt,
    );

    if (Number.isNaN(createdAt.getTime())) {
      throw new Error("Invalid cursor date.");
    }

    return {
      createdAt,
      id: validation.data.id,
    };
  } catch {
    throw new ApplicationError(
      400,
      "NOTIFICATION_CURSOR_INVALID",
      "The notification cursor is invalid.",
    );
  }
}

function encodeNotificationCursor(
  cursor: NotificationCursor,
): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

export async function listNotifications(
  dependencies: NotificationDependencies,
  input: {
    userId: string;
    limit: number;
    unreadOnly: boolean;
    encodedCursor?: string;
  },
): Promise<NotificationPageDto> {
  const records = await listNotificationRecords(
    dependencies.prisma,
    {
      userId: input.userId,
      limit: input.limit,
      unreadOnly: input.unreadOnly,
      cursor: input.encodedCursor
        ? decodeNotificationCursor(
            input.encodedCursor,
          )
        : null,
    },
  );

  const hasMore = records.length > input.limit;
  const pageRecords = hasMore
    ? records.slice(0, input.limit)
    : records;
  const lastRecord = pageRecords.at(-1);

  return {
    items: pageRecords.map(toNotificationDto),
    nextCursor:
      hasMore && lastRecord
        ? encodeNotificationCursor({
            createdAt: lastRecord.createdAt,
            id: lastRecord.id,
          })
        : null,
  };
}
