import { randomUUID } from "node:crypto";

import { ApplicationError } from "../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";
import {
  findEventOperationsRecord,
  findParticipantUpdatesRecord,
} from "./eventOperations.repository.js";
import { storageExtension, toNoteDto, toOperationsDto } from "./eventOperations.support.js";
import type {
  EventCompletionReadinessDto,
  EventEvidenceUploadIntentDto,
  EventOperationsDto,
  ParticipantEventUpdatesDto,
} from "./eventOperations.types.js";
import type { ValidatedEventEvidenceUploadIntent } from "./eventOperations.validation.js";

export async function getEventOperations(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  eventId: string,
): Promise<EventOperationsDto> {
  const record = await findEventOperationsRecord(dependencies.prisma, organizationId, eventId);
  if (!record) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The organization cleanup event was not found.");
  return toOperationsDto(dependencies, record);
}

export async function getParticipantEventUpdates(
  dependencies: CleanupEventDependencies,
  eventId: string,
  userId: string,
): Promise<ParticipantEventUpdatesDto> {
  const record = await findParticipantUpdatesRecord(dependencies.prisma, eventId, userId);
  if (!record) throw new ApplicationError(404, "EVENT_PARTICIPATION_NOT_FOUND", "No eligible participation was found for this event.");
  return {
    event: {
      id: record.id,
      title: record.title,
      lifecycleStatus: record.lifecycleStatus,
      completedAt: record.completedAt?.toISOString() ?? null,
      cancelledAt: record.cancelledAt?.toISOString() ?? null,
      cancellationReason: record.cancellationReason,
    },
    notes: record.notes.map(toNoteDto),
  };
}

export async function createEventEvidenceUploadIntents(
  dependencies: CleanupEventDependencies,
  input: ValidatedEventEvidenceUploadIntent & {
    organizationId: string;
    eventId: string;
    actorUserId: string;
  },
): Promise<EventEvidenceUploadIntentDto[]> {
  const event = await findEventOperationsRecord(dependencies.prisma, input.organizationId, input.eventId);
  if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The organization cleanup event was not found.");
  if (event.lifecycleStatus === "COMPLETED" || event.lifecycleStatus === "CANCELLED") {
    throw new ApplicationError(409, "EVENT_TERMINAL", "Evidence cannot be added to a completed or cancelled event.");
  }
  return Promise.all(input.files.map(async (file) => {
    const storagePath = `events/${input.organizationId}/${input.eventId}/${input.actorUserId}/${randomUUID()}.${storageExtension(file.contentType)}`;
    const intent = await dependencies.eventEvidenceStorage.createUploadIntent(storagePath);
    return { ...intent, storagePath, ...file };
  }));
}

export function getCompletionReadinessFromRecord(
  record: NonNullable<Awaited<ReturnType<typeof findEventOperationsRecord>>>,
): EventCompletionReadinessDto {
  const completionTransition = record.currentWorkflowStatus.outgoingTransitions.find(
    ({ toStatus }) => toStatus.mappedLifecycleStatus === "COMPLETED",
  );
  const sessionsFinal = record.sessions.length > 0 && record.sessions.every(({ status }) => status === "COMPLETED" || status === "CANCELLED");
  const completedSession = record.sessions.some(({ status }) => status === "COMPLETED");
  const attendanceFinal = record.participants.every(({ allocations }) => allocations.every(({ status }) => status !== "PLANNED"));
  const afterEvidence = record.evidence.some(({ type }) => type === "AFTER");
  const checks = [
    { code: "WORKFLOW_COMPLETION", ready: Boolean(completionTransition), message: completionTransition ? "The configured workflow permits completion." : "Move the event to a status that can transition to Completed." },
    { code: "SESSIONS_FINAL", ready: sessionsFinal, message: sessionsFinal ? "Every session has a final status." : "Complete or cancel every session before completing the event." },
    { code: "COMPLETED_SESSION", ready: completedSession, message: completedSession ? "At least one cleanup session was completed." : "At least one session must be completed." },
    { code: "ATTENDANCE_FINAL", ready: attendanceFinal, message: attendanceFinal ? "Every allocation has final attendance." : "Record attendance or remove every remaining planned allocation." },
    { code: "AFTER_EVIDENCE", ready: afterEvidence, message: afterEvidence ? "After-cleanup evidence is available." : "Upload at least one AFTER evidence photo." },
  ];
  return { eventId: record.id, ready: checks.every(({ ready }) => ready), checks };
}

export async function getEventCompletionReadiness(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  eventId: string,
): Promise<EventCompletionReadinessDto> {
  const record = await findEventOperationsRecord(dependencies.prisma, organizationId, eventId);
  if (!record) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The organization cleanup event was not found.");
  return getCompletionReadinessFromRecord(record);
}
