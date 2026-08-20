import { ApplicationError } from "../../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import {
  createEventEvidenceRecord,
  findEventOperationsRecord,
} from "../eventOperations.repository.js";
import { assertMutableEvent, toEvidenceDto } from "../eventOperations.support.js";
import type { EventOperationEvidenceDto } from "../eventOperations.types.js";
import type { ValidatedRegisterEventEvidence } from "../eventOperations.validation.js";

export async function registerEventEvidence(
  dependencies: CleanupEventDependencies,
  input: ValidatedRegisterEventEvidence & {
    organizationId: string;
    eventId: string;
    actorUserId: string;
  },
): Promise<EventOperationEvidenceDto> {
  const event = await findEventOperationsRecord(dependencies.prisma, input.organizationId, input.eventId);
  if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The organization cleanup event was not found.");
  assertMutableEvent(event.lifecycleStatus);
  if (input.sessionId && !event.sessions.some(({ id }) => id === input.sessionId)) {
    throw new ApplicationError(422, "EVENT_EVIDENCE_SESSION_INVALID", "The evidence session does not belong to this cleanup event.");
  }
  const expectedPrefix = `events/${input.organizationId}/${input.eventId}/${input.actorUserId}/`;
  if (!input.storagePath.startsWith(expectedPrefix)) {
    throw new ApplicationError(422, "EVENT_EVIDENCE_PATH_INVALID", "The evidence upload does not belong to this event and user.");
  }
  if (!(await dependencies.eventEvidenceStorage.objectExists(input.storagePath))) {
    throw new ApplicationError(422, "EVENT_EVIDENCE_MISSING", `The upload for ${input.originalFileName} is incomplete.`);
  }
  const evidence = await dependencies.prisma.$transaction(async (transaction) => {
    const current = await findEventOperationsRecord(transaction, input.organizationId, input.eventId);
    if (!current) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The organization cleanup event was not found.");
    assertMutableEvent(current.lifecycleStatus);
    const created = await createEventEvidenceRecord(transaction, {
      eventId: current.id,
      sessionId: input.sessionId ?? null,
      uploadedByUserId: input.actorUserId,
      type: input.type,
      storagePath: input.storagePath,
      caption: input.caption ?? null,
    });
    await transaction.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: "EVENT_EVIDENCE_ADDED",
      entityType: "EventEvidence",
      entityId: created.id,
      metadata: { eventId: current.id, sessionId: input.sessionId ?? null, type: input.type },
    } });
    return created;
  }, { timeout: 30_000 });
  return toEvidenceDto(dependencies, evidence);
}
