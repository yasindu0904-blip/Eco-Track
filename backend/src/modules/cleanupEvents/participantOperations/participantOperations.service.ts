import { ApplicationError } from "../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";
import {
  findParticipantOperationsEvent,
  listParticipantOperationRecords,
  type ParticipantOperationsCursor,
} from "./participantOperations.repository.js";
import { toOperationSessionDto, toParticipantOperationDto } from "./participantOperations.support.js";
import type { EventParticipantOperationsPageDto } from "./participantOperations.types.js";
import type { ValidatedListEventParticipantsQuery } from "./participantOperations.validation.js";

function decodeCursor(cursor?: string): ParticipantOperationsCursor | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      joinedAt?: unknown;
      id?: unknown;
    };
    const joinedAt = new Date(String(value.joinedAt));
    if (Number.isNaN(joinedAt.getTime()) || typeof value.id !== "string" || !/^[0-9a-f-]{36}$/i.test(value.id)) {
      throw new Error();
    }
    return { joinedAt, id: value.id };
  } catch {
    throw new ApplicationError(400, "PARTICIPANT_CURSOR_INVALID", "The participant cursor is invalid.");
  }
}

export async function listEventParticipantOperations(
  dependencies: CleanupEventDependencies,
  organizationId: string,
  eventId: string,
  query: ValidatedListEventParticipantsQuery,
): Promise<EventParticipantOperationsPageDto> {
  const event = await findParticipantOperationsEvent(dependencies.prisma, organizationId, eventId);
  if (!event) {
    throw new ApplicationError(404, "CLEANUP_EVENT_NOT_FOUND", "The organization cleanup event was not found.");
  }
  const records = await listParticipantOperationRecords(dependencies.prisma, {
    eventId,
    status: query.status,
    limit: query.limit,
    cursor: decodeCursor(query.cursor),
  });
  const hasMore = records.length > query.limit;
  const page = hasMore ? records.slice(0, query.limit) : records;
  const last = page.at(-1);
  return {
    event: { id: event.id, title: event.title, lifecycleStatus: event.lifecycleStatus },
    sessions: event.sessions.map(toOperationSessionDto),
    participants: page.map(toParticipantOperationDto),
    nextCursor: hasMore && last
      ? Buffer.from(JSON.stringify({ joinedAt: last.joinedAt.toISOString(), id: last.id }), "utf8").toString("base64url")
      : null,
  };
}

