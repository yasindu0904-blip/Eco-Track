import { ApplicationError } from "../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";
import type { EventParticipationDto, EventParticipationPageDto } from "../cleanupEvent.types.js";
import { uuidSchema, type ValidatedMyParticipationsQuery } from "../cleanupEvent.validation.js";
import { findParticipation, listMyParticipationRecords, type ParticipationCursor } from "./participation.repository.js";
import { toParticipationDto } from "./participation.support.js";

export async function getMyParticipation(dependencies: CleanupEventDependencies, eventId: string, userId: string): Promise<EventParticipationDto | null> {
  const record = await findParticipation(dependencies.prisma, eventId, userId);
  return record ? toParticipationDto(record) : null;
}

function decodeCursor(cursor?: string): ParticipationCursor | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { joinedAt?: unknown; id?: unknown };
    const joinedAt = new Date(String(value.joinedAt));
    const id = uuidSchema.safeParse(value.id);
    if (Number.isNaN(joinedAt.getTime()) || !id.success) throw new Error();
    return { joinedAt, id: id.data };
  } catch {
    throw new ApplicationError(400, "PARTICIPATION_CURSOR_INVALID", "The participation cursor is invalid.");
  }
}

export async function listMyParticipations(
  dependencies: CleanupEventDependencies,
  userId: string,
  query: ValidatedMyParticipationsQuery,
): Promise<EventParticipationPageDto> {
  const records = await listMyParticipationRecords(dependencies.prisma, { ...query, userId, cursor: decodeCursor(query.cursor) });
  const hasMore = records.length > query.limit;
  const items = records.slice(0, query.limit);
  const last = items.at(-1);
  return {
    items: items.map(toParticipationDto),
    nextCursor: hasMore && last
      ? Buffer.from(JSON.stringify({ joinedAt: last.joinedAt.toISOString(), id: last.id }), "utf8").toString("base64url")
      : null,
  };
}
