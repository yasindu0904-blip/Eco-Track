import {
  NotificationType,
  type Prisma,
} from "../../../generated/prisma/client.js";
import { ApplicationError } from "../../../errors/applicationError.js";
import { createNotificationRecord } from "../../notifications/repositories/notification.repository.js";
import type { EventParticipantOperationDto } from "./participantOperations.types.js";
import type { ParticipantOperationRecord } from "./participantOperations.repository.js";

export function toParticipantOperationDto(
  record: ParticipantOperationRecord,
): EventParticipantOperationDto {
  return {
    id: record.id,
    status: record.status,
    attendanceStatus: record.attendanceStatus,
    attendanceMarkedAt: record.attendanceMarkedAt?.toISOString() ?? null,
    joinedAt: record.joinedAt.toISOString(),
    removedAt: record.removedAt?.toISOString() ?? null,
    volunteer: {
      id: record.user.id,
      fullName: record.user.fullName,
      phoneNumber: record.user.phoneNumber,
    },
  };
}

export function requireOperationalLifecycle(status: string): void {
  if (status !== "PUBLISHED")
    throw new ApplicationError(
      409,
      "EVENT_PARTICIPANT_OPERATIONS_CLOSED",
      "Participant operations are only available for a published cleanup event.",
    );
}

export function requireAttendanceOpen(
  event: { startsAt: Date | null },
  now = new Date(),
): void {
  if (!event.startsAt || event.startsAt.getTime() > now.getTime()) {
    throw new ApplicationError(
      409,
      "ATTENDANCE_NOT_OPEN",
      "Attendance opens when the cleanup event starts.",
    );
  }
}

export async function notifyParticipantOperation(
  transaction: Prisma.TransactionClient,
  input: {
    userId: string;
    organizationId: string;
    eventId: string;
    title: string;
    message: string;
    status: string;
  },
): Promise<void> {
  await createNotificationRecord(transaction, {
    userId: input.userId,
    organizationId: input.organizationId,
    type: NotificationType.EVENT_UPDATED,
    title: input.title,
    message: input.message,
    data: {
      eventId: input.eventId,
      organizationId: input.organizationId,
      status: input.status,
    },
  });
}
