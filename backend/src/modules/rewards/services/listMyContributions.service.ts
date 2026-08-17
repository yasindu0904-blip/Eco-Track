import { Buffer } from "node:buffer";

import { ApplicationError } from "../../../errors/applicationError.js";
import { ContributionType } from "../../../generated/prisma/enums.js";

import { CONTRIBUTION_LABELS } from "../reward.constants.js";
import type { RewardDependencies } from "../reward.dependencies.js";
import type {
  ContributionCursor,
  ContributionDto,
  ContributionPageDto,
} from "../reward.types.js";
import { contributionCursorPayloadSchema } from "../reward.validation.js";
import { listContributionRecords } from "../repositories/reward.repository.js";

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
      "CONTRIBUTION_CURSOR_INVALID",
      "The contribution-history cursor is invalid.",
    );
  }
}

function encodeCursor(cursor: ContributionCursor): string {
  return Buffer.from(JSON.stringify({
    createdAt: cursor.createdAt.toISOString(),
    id: cursor.id,
  }), "utf8").toString("base64url");
}

function toContributionDto(record: Awaited<ReturnType<typeof listContributionRecords>>[number]): ContributionDto {
  let reason: string;
  let cleanupEventId = record.cleanupEventId;

  switch (record.type) {
    case ContributionType.VERIFIED_INCIDENT_REPORT:
      reason = record.incident
        ? `Your report “${record.incident.title}” received an authorized VALID organization review.`
        : "Your incident report received an authorized VALID organization review.";
      break;
    case ContributionType.SESSION_ATTENDED: {
      const event = record.sessionAllocation?.session.cleanupEvent;
      const date = record.sessionAllocation?.session.sessionDate;
      cleanupEventId = event?.id ?? null;
      reason = event && date
        ? `Attendance was confirmed for “${event.title}” on ${date.toISOString().slice(0, 10)}.`
        : "An authorized coordinator confirmed your cleanup-session attendance.";
      break;
    }
    case ContributionType.EVENT_COMPLETED:
      reason = record.cleanupEvent
        ? `You contributed to the completed cleanup event “${record.cleanupEvent.title}”.`
        : "You contributed to a completed cleanup event.";
      break;
    case ContributionType.SPECIAL_CONTRIBUTION:
      reason = "An authorized EcoTrack administrator approved a special community contribution.";
      break;
  }

  return {
    id: record.id,
    type: record.type,
    label: CONTRIBUTION_LABELS[record.type],
    points: record.points,
    reason,
    incidentId: record.incidentId,
    cleanupEventId,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function listMyContributions(
  dependencies: RewardDependencies,
  input: {
    userId: string;
    limit: number;
    encodedCursor?: string;
  },
): Promise<ContributionPageDto> {
  const records = await listContributionRecords(
    dependencies.prisma,
    {
      userId: input.userId,
      limit: input.limit,
      cursor: input.encodedCursor ? decodeCursor(input.encodedCursor) : null,
    },
  );
  const hasMore = records.length > input.limit;
  const pageRecords = hasMore ? records.slice(0, input.limit) : records;
  const last = pageRecords.at(-1);

  return {
    items: pageRecords.map(toContributionDto),
    nextCursor: hasMore && last
      ? encodeCursor({ createdAt: last.createdAt, id: last.id })
      : null,
  };
}
