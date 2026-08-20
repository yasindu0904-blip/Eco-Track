import { NotificationType, type Prisma } from "../../../generated/prisma/client.js";
import { ApplicationError } from "../../../errors/applicationError.js";
import { createNotificationRecord } from "../../notifications/repositories/notification.repository.js";
import type {
  EventParticipantOperationDto,
  ParticipantOperationAllocationDto,
  ParticipantOperationSessionDto,
} from "./participantOperations.types.js";
import type { ParticipantOperationRecord } from "./participantOperations.repository.js";

export function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function timeOnly(value: Date): string {
  return value.toISOString().slice(11, 19);
}

export function toParticipantOperationDto(
  record: ParticipantOperationRecord,
): EventParticipantOperationDto {
  return {
    id: record.id,
    status: record.status,
    joinedAt: record.joinedAt.toISOString(),
    removedAt: record.removedAt?.toISOString() ?? null,
    volunteer: {
      id: record.user.id,
      fullName: record.user.fullName,
      phoneNumber: record.user.phoneNumber,
    },
    availableSessionIds: record.availabilities.map(({ sessionId }) => sessionId),
    allocations: record.allocations.map(toAllocationDto),
  };
}

export function toAllocationDto(record: {
  id: string;
  participantId: string;
  sessionId: string;
  status: "PLANNED" | "ATTENDED" | "ABSENT" | "REMOVED";
  allocatedAt: Date;
  attendanceMarkedAt: Date | null;
  notes: string | null;
}): ParticipantOperationAllocationDto {
  return {
    id: record.id,
    participantId: record.participantId,
    sessionId: record.sessionId,
    status: record.status,
    allocatedAt: record.allocatedAt.toISOString(),
    attendanceMarkedAt: record.attendanceMarkedAt?.toISOString() ?? null,
    notes: record.notes,
  };
}

export function toOperationSessionDto(record: {
  id: string;
  sessionDate: Date;
  startTime: Date;
  endTime: Date;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  capacity: number | null;
  _count: { allocations: number };
}): ParticipantOperationSessionDto {
  return {
    id: record.id,
    sessionDate: dateOnly(record.sessionDate),
    startTime: timeOnly(record.startTime),
    endTime: timeOnly(record.endTime),
    status: record.status,
    capacity: record.capacity,
    allocatedCount: record._count.allocations,
  };
}

export function requireOperationalLifecycle(status: string): void {
  if (!["PUBLISHED", "SCHEDULED", "IN_PROGRESS"].includes(status)) {
    throw new ApplicationError(
      409,
      "EVENT_PARTICIPANT_OPERATIONS_CLOSED",
      "Participant operations are closed for this cleanup event.",
    );
  }
}

export function requireAvailableTargetSession(
  participant: { status: string; availabilities: Array<{ sessionId: string }> },
  session: { id: string; status: string; sessionDate: Date; startTime: Date },
  now = new Date(),
): void {
  if (participant.status !== "JOINED") {
    throw new ApplicationError(409, "PARTICIPANT_NOT_ACTIVE", "Only a joined volunteer can be allocated.");
  }
  if (session.status !== "SCHEDULED") {
    throw new ApplicationError(409, "SESSION_NOT_ALLOCATABLE", "The target session is not available for allocation.");
  }
  if (hasSessionStarted(session.sessionDate, session.startTime, now)) {
    throw new ApplicationError(409, "SESSION_ALLOCATION_CLOSED", "Allocation is closed after the session starts.");
  }
  if (!participant.availabilities.some(({ sessionId }) => sessionId === session.id)) {
    throw new ApplicationError(409, "PARTICIPANT_NOT_AVAILABLE", "The volunteer did not mark the target session as available.");
  }
}

export function hasSessionStarted(sessionDate: Date, startTime: Date, now: Date): boolean {
  const startsAt = new Date(`${dateOnly(sessionDate)}T${timeOnly(startTime)}+05:30`);
  return startsAt.getTime() <= now.getTime();
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
    sessionId?: string;
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
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    },
  });
}
