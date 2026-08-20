import { ApplicationError } from "../../../errors/applicationError.js";
import type { SessionStatus } from "../../../generated/prisma/enums.js";
import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";
import { NotificationType } from "../../../generated/prisma/enums.js";
import { createNotification } from "../../notifications/services/createNotification.service.js";
import { SESSION_STATUS_TRANSITIONS } from "./eventOperations.constants.js";
import {
  listActiveParticipantUserIds,
  type EventOperationsDatabase,
  type EventOperationsRecord,
} from "./eventOperations.repository.js";
import type {
  EventOperationEvidenceDto,
  EventOperationNoteDto,
  EventOperationsDto,
} from "./eventOperations.types.js";

export function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function formatTime(value: Date): string {
  return value.toISOString().slice(11, 19);
}

export function toNoteDto(note: EventOperationsRecord["notes"][number]): EventOperationNoteDto {
  return {
    id: note.id,
    visibility: note.visibility,
    noteText: note.noteText,
    author: { id: note.author.id, fullName: note.author.user.fullName },
    createdAt: note.createdAt.toISOString(),
  };
}

export async function toEvidenceDto(
  dependencies: CleanupEventDependencies,
  evidence: EventOperationsRecord["evidence"][number],
): Promise<EventOperationEvidenceDto> {
  return {
    id: evidence.id,
    sessionId: evidence.sessionId,
    type: evidence.type,
    caption: evidence.caption,
    url: await dependencies.eventEvidenceStorage.createDownloadUrl(evidence.storagePath),
    uploadedBy: { id: evidence.uploadedBy.id, fullName: evidence.uploadedBy.fullName },
    uploadedAt: evidence.uploadedAt.toISOString(),
  };
}

export async function toOperationsDto(
  dependencies: CleanupEventDependencies,
  record: EventOperationsRecord,
): Promise<EventOperationsDto> {
  return {
    event: {
      id: record.id,
      organizationId: record.organizationId,
      incidentId: record.incidentId,
      title: record.title,
      lifecycleStatus: record.lifecycleStatus,
      updatedAt: record.updatedAt.toISOString(),
      completedAt: record.completedAt?.toISOString() ?? null,
      cancelledAt: record.cancelledAt?.toISOString() ?? null,
      cancellationReason: record.cancellationReason,
      currentWorkflowStatus: {
        id: record.currentWorkflowStatus.id,
        code: record.currentWorkflowStatus.code,
        label: record.currentWorkflowStatus.label,
        lifecycleStatus: record.currentWorkflowStatus.mappedLifecycleStatus,
      },
    },
    sessions: record.sessions.map((session) => ({
      id: session.id,
      sessionDate: formatDate(session.sessionDate),
      startTime: formatTime(session.startTime),
      endTime: formatTime(session.endTime),
      status: session.status,
      updatedAt: session.updatedAt.toISOString(),
    })),
    notes: record.notes.map(toNoteDto),
    evidence: await Promise.all(record.evidence.map((item) => toEvidenceDto(dependencies, item))),
    history: record.statusHistory.map((history) => ({
      id: history.id,
      fromStatus: history.fromStatus ? {
        id: history.fromStatus.id,
        label: history.fromStatus.label,
        lifecycleStatus: history.fromStatus.mappedLifecycleStatus,
      } : null,
      toStatus: {
        id: history.toStatus.id,
        label: history.toStatus.label,
        lifecycleStatus: history.toStatus.mappedLifecycleStatus,
      },
      changedBy: { id: history.changedBy.id, fullName: history.changedBy.user.fullName },
      notes: history.notes,
      changedAt: history.changedAt.toISOString(),
    })),
    availableTransitions: record.currentWorkflowStatus.outgoingTransitions.map(({ toStatus }) => ({
      id: toStatus.id,
      code: toStatus.code,
      label: toStatus.label,
      lifecycleStatus: toStatus.mappedLifecycleStatus,
    })),
  };
}

export function requireSessionTransition(from: SessionStatus, to: SessionStatus): void {
  const allowed = SESSION_STATUS_TRANSITIONS[from] as readonly SessionStatus[];
  if (!allowed.includes(to)) {
    throw new ApplicationError(409, "SESSION_TRANSITION_INVALID", `A session cannot move from ${from} to ${to}.`);
  }
}

export function assertMutableEvent(lifecycleStatus: string): void {
  if (lifecycleStatus === "COMPLETED" || lifecycleStatus === "CANCELLED") {
    throw new ApplicationError(409, "EVENT_TERMINAL", "A completed or cancelled event cannot be changed.");
  }
}

export function storageExtension(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export async function notifyActiveParticipants(
  database: EventOperationsDatabase,
  input: {
    eventId: string;
    organizationId: string;
    type: "EVENT_UPDATED" | "EVENT_CANCELLED" | "EVENT_COMPLETED";
    title: string;
    message: string;
    extraData?: Record<string, string>;
  },
): Promise<number> {
  const recipients = await listActiveParticipantUserIds(database, input.eventId);
  for (const { userId } of recipients) {
    await createNotification(
      { prisma: database },
      {
        userId,
        organizationId: input.organizationId,
        type: NotificationType[input.type],
        title: input.title,
        message: input.message,
        data: { eventId: input.eventId, organizationId: input.organizationId, ...input.extraData },
      },
    );
  }
  return recipients.length;
}
