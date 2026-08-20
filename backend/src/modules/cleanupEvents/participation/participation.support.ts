import { NotificationType, type Prisma } from "../../../generated/prisma/client.js";
import { ApplicationError } from "../../../errors/applicationError.js";
import { createNotificationRecord } from "../../notifications/repositories/notification.repository.js";
import type { CleanupEventPublicDetailDto, EventParticipationDto } from "../cleanupEvent.types.js";
import { joinableLifecycleStatuses, type ParticipationRecord, findParticipationEvent } from "./participation.repository.js";

function dateOnly(value: Date): string { return value.toISOString().slice(0, 10); }
function timeOnly(value: Date): string { return value.toISOString().slice(11, 19); }

function toEvent(record: ParticipationRecord["cleanupEvent"]): CleanupEventPublicDetailDto {
  if (record.lifecycleStatus === "DRAFT" || !record.publishedAt) {
    throw new ApplicationError(500, "PARTICIPATION_EVENT_INVALID", "The participation event is unavailable.");
  }
  const sessions = record.sessions.map((session) => ({
    id: session.id,
    sessionDate: dateOnly(session.sessionDate),
    startTime: timeOnly(session.startTime),
    endTime: timeOnly(session.endTime),
    capacity: session.capacity,
    locationLatitude: session.locationLatitude === null ? null : Number(session.locationLatitude),
    locationLongitude: session.locationLongitude === null ? null : Number(session.locationLongitude),
    locationAddress: session.locationAddress,
  }));
  const first = sessions[0];
  return {
    id: record.id,
    organization: record.organization,
    incidentId: record.incidentId,
    title: record.title,
    description: record.description,
    lifecycleStatus: record.lifecycleStatus,
    eventLatitude: Number(record.eventLatitude),
    eventLongitude: Number(record.eventLongitude),
    eventAddress: record.eventAddress,
    publishedAt: record.publishedAt.toISOString(),
    firstSessionAt: first ? `${first.sessionDate}T${first.startTime}+05:30` : null,
    publicInstructions: record.publicInstructions ?? "",
    meetingLatitude: record.meetingLatitude === null ? null : Number(record.meetingLatitude),
    meetingLongitude: record.meetingLongitude === null ? null : Number(record.meetingLongitude),
    meetingAddress: record.meetingAddress,
    sessions,
  };
}

export function toParticipationDto(record: ParticipationRecord): EventParticipationDto {
  return {
    id: record.id,
    status: record.status,
    joinedAt: record.joinedAt.toISOString(),
    withdrawnAt: record.withdrawnAt?.toISOString() ?? null,
    availableSessionIds: record.availabilities.map(({ sessionId }) => sessionId),
    allocations: record.allocations.map((allocation) => ({
      id: allocation.id,
      sessionId: allocation.sessionId,
      status: allocation.status,
      allocatedAt: allocation.allocatedAt.toISOString(),
      attendanceMarkedAt: allocation.attendanceMarkedAt?.toISOString() ?? null,
    })),
    event: toEvent(record.cleanupEvent),
  };
}

function isFutureSession(sessionDate: Date, startTime: Date, now: Date): boolean {
  return new Date(`${dateOnly(sessionDate)}T${timeOnly(startTime)}+05:30`).getTime() > now.getTime();
}

export function validateSelectedSessions(
  event: NonNullable<Awaited<ReturnType<typeof findParticipationEvent>>>,
  sessionIds: string[],
  now: Date,
): void {
  const selected = new Set(sessionIds);
  const valid = event.sessions.filter((session) =>
    selected.has(session.id) && session.status === "SCHEDULED" && isFutureSession(session.sessionDate, session.startTime, now));
  if (valid.length !== selected.size) {
    throw new ApplicationError(409, "SESSION_NOT_AVAILABLE", "Every selected session must belong to this event and remain scheduled in the future.");
  }
}

export function requireJoinableEvent(status: string): void {
  if (!(joinableLifecycleStatuses as readonly string[]).includes(status)) {
    throw new ApplicationError(409, "EVENT_NOT_JOINABLE", "This cleanup event is not currently open for joining.");
  }
}

export async function notifyParticipationOperations(
  transaction: Prisma.TransactionClient,
  event: NonNullable<Awaited<ReturnType<typeof findParticipationEvent>>>,
  userId: string,
  action: "joined" | "withdrew",
): Promise<void> {
  const recipients = new Set(event.coordinators.map(({ membership }) => membership.userId));
  for (const membership of event.organization.memberships) recipients.add(membership.userId);
  for (const recipient of recipients) {
    if (recipient === userId) continue;
    await createNotificationRecord(transaction, {
      userId: recipient,
      organizationId: event.organizationId,
      type: action === "joined" ? NotificationType.EVENT_JOINED : NotificationType.EVENT_UPDATED,
      title: action === "joined" ? "Volunteer joined an event" : "Volunteer withdrew from an event",
      message: `A volunteer ${action} ${event.title}.`,
      data: { eventId: event.id, organizationId: event.organizationId, status: action.toUpperCase() },
    });
  }
}
