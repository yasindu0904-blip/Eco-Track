import { ApplicationError } from "../../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../../cleanupEvent.dependencies.js";
import {
  createEventNoteRecord,
  findEventOperationsRecord,
} from "../eventOperations.repository.js";
import { assertMutableEvent, notifyActiveParticipants, toNoteDto } from "../eventOperations.support.js";
import type { EventOperationNoteDto } from "../eventOperations.types.js";
import type { ValidatedAddEventNote } from "../eventOperations.validation.js";

export async function addEventNote(
  dependencies: CleanupEventDependencies,
  input: ValidatedAddEventNote & {
    organizationId: string;
    eventId: string;
    actorMembershipId: string;
    actorUserId: string;
  },
): Promise<EventOperationNoteDto> {
  return dependencies.prisma.$transaction(async (transaction) => {
    const event = await findEventOperationsRecord(transaction, input.organizationId, input.eventId);
    if (!event) throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The organization cleanup event was not found.");
    assertMutableEvent(event.lifecycleStatus);
    const note = await createEventNoteRecord(transaction, {
      eventId: event.id,
      authorMembershipId: input.actorMembershipId,
      visibility: input.visibility,
      noteText: input.noteText,
    });
    await transaction.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: "EVENT_NOTE_ADDED",
      entityType: "EventNote",
      entityId: note.id,
      metadata: { eventId: event.id, visibility: note.visibility },
    } });
    if (note.visibility === "PARTICIPANTS") {
      await notifyActiveParticipants(transaction, {
        eventId: event.id,
        organizationId: input.organizationId,
        type: "EVENT_UPDATED",
        title: "Cleanup event update",
        message: `A new participant update is available for ${event.title}.`,
      });
    }
    return toNoteDto(note);
  }, { timeout: 30_000 });
}
