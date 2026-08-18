import { Buffer } from "node:buffer";

import { ApplicationError } from "../../../errors/applicationError.js";

import type { RewardDependencies } from "../reward.dependencies.js";
import type {
  CompletedCleanupEventHistoryDto,
  ContributionCursor,
} from "../reward.types.js";
import { contributionCursorPayloadSchema } from "../reward.validation.js";
import { listCompletedCleanupEventRecords } from "../repositories/reward.repository.js";

function decodeCursor(encodedCursor: string): ContributionCursor {
  try {
    const payload = JSON.parse(
      Buffer.from(encodedCursor, "base64url").toString("utf8"),
    );
    const validation = contributionCursorPayloadSchema.safeParse(payload);
    if (!validation.success) throw new Error("Invalid cursor.");
    const createdAt = new Date(validation.data.createdAt);
    if (Number.isNaN(createdAt.getTime())) throw new Error("Invalid cursor date.");
    return { createdAt, id: validation.data.id };
  } catch {
    throw new ApplicationError(
      400,
      "COMPLETED_EVENT_CURSOR_INVALID",
      "The historical-review cursor is invalid.",
    );
  }
}

function encodeCursor(cursor: ContributionCursor): string {
  return Buffer.from(JSON.stringify({
    createdAt: cursor.createdAt.toISOString(),
    id: cursor.id,
  }), "utf8").toString("base64url");
}

export async function listMyCompletedCleanupEvents(
  dependencies: RewardDependencies,
  input: {
    userId: string;
    limit: number;
    encodedCursor?: string;
  },
): Promise<CompletedCleanupEventHistoryDto> {
  const result = await listCompletedCleanupEventRecords(dependencies.prisma, {
    userId: input.userId,
    limit: input.limit,
    cursor: input.encodedCursor ? decodeCursor(input.encodedCursor) : null,
  });
  const hasMore = result.records.length > input.limit;
  const pageRecords = hasMore
    ? result.records.slice(0, input.limit)
    : result.records;
  const last = pageRecords.at(-1);

  return {
    totalCount: result.totalCount,
    items: pageRecords.flatMap((record) => {
      if (!record.cleanupEvent?.completedAt) return [];
      return [{
        contributionId: record.id,
        cleanupEventId: record.cleanupEvent.id,
        title: record.cleanupEvent.title,
        completedAt: record.cleanupEvent.completedAt.toISOString(),
        verifiedAt: record.createdAt.toISOString(),
      }];
    }),
    nextCursor: hasMore && last
      ? encodeCursor({ createdAt: last.createdAt, id: last.id })
      : null,
  };
}
