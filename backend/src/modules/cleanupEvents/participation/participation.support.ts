import {
  NotificationType,
  type Prisma,
} from "../../../generated/prisma/client.js";
import { ApplicationError } from "../../../errors/applicationError.js";
import { createNotificationRecord } from "../../notifications/repositories/notification.repository.js";
import { cleanupEventDisplayStatus } from "../services/cleanupEvent.service.js";
import type {
  CleanupEventPublicDetailDto,
  EventParticipationDto,
} from "../cleanupEvent.types.js";
import {
  joinableLifecycleStatuses,
  type ParticipationRecord,
  findParticipationEvent,
} from "./participation.repository.js";

function toEvent(
  record: ParticipationRecord["cleanupEvent"],
): CleanupEventPublicDetailDto {
  if (
    record.lifecycleStatus === "DRAFT" ||
    !record.publishedAt ||
    !record.startsAt
  ) {
    throw new ApplicationError(
      500,
      "PARTICIPATION_EVENT_INVALID",
      "The participation event is unavailable.",
    );
  }
  const lifecycleStatus = ["COMPLETED", "CANCELLED"].includes(
    record.lifecycleStatus,
  )
    ? (record.lifecycleStatus as "COMPLETED" | "CANCELLED")
    : "PUBLISHED";
  return {
    id: record.id,
    organization: record.organization,
    incidentId: record.incidentId,
    title: record.title,
    description: record.description,
    lifecycleStatus,
    displayStatus: cleanupEventDisplayStatus(
      lifecycleStatus,
      record.startsAt,
    ) as CleanupEventPublicDetailDto["displayStatus"],
    eventLatitude: Number(record.eventLatitude),
    eventLongitude: Number(record.eventLongitude),
    eventAddress: record.eventAddress,
    startsAt: record.startsAt.toISOString(),
    capacity: record.capacity,
    publishedAt: record.publishedAt.toISOString(),
    publicInstructions: record.publicInstructions ?? "",
    meetingLatitude:
      record.meetingLatitude === null ? null : Number(record.meetingLatitude),
    meetingLongitude:
      record.meetingLongitude === null ? null : Number(record.meetingLongitude),
    meetingAddress: record.meetingAddress,
    joinedVolunteerCount: record._count.participants,
  };
}

export function toParticipationDto(
  record: ParticipationRecord,
): EventParticipationDto {
  return {
    id: record.id,
    status: record.status,
    attendanceStatus: record.attendanceStatus,
    attendanceMarkedAt: record.attendanceMarkedAt?.toISOString() ?? null,
    joinedAt: record.joinedAt.toISOString(),
    withdrawnAt: record.withdrawnAt?.toISOString() ?? null,
    event: toEvent(record.cleanupEvent),
  };
}

export function requireJoinableEvent(status: string): void {
  if (!(joinableLifecycleStatuses as readonly string[]).includes(status)) {
    throw new ApplicationError(
      409,
      "EVENT_NOT_JOINABLE",
      "This cleanup event is not currently open for volunteering.",
    );
  }
}

export async function notifyParticipationOperations(
  transaction: Prisma.TransactionClient,
  event: NonNullable<Awaited<ReturnType<typeof findParticipationEvent>>>,
  userId: string,
  action: "joined" | "withdrew",
): Promise<void> {
  const recipients = new Set(
    event.coordinators.map(({ membership }) => membership.userId),
  );
  for (const membership of event.organization.memberships)
    recipients.add(membership.userId);
  for (const recipient of recipients) {
    if (recipient === userId) continue;
    await createNotificationRecord(transaction, {
      userId: recipient,
      organizationId: event.organizationId,
      type:
        action === "joined"
          ? NotificationType.EVENT_JOINED
          : NotificationType.EVENT_UPDATED,
      title:
        action === "joined"
          ? "Volunteer joined an event"
          : "Volunteer withdrew from an event",
      message: `A volunteer ${action} ${event.title}.`,
      data: {
        eventId: event.id,
        organizationId: event.organizationId,
        status: action.toUpperCase(),
      },
    });
  }
}
