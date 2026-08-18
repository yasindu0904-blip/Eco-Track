import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../../generated/prisma/client.js";
import {
  AllocationStatus,
  CleanupLifecycleStatus,
  ContributionType,
  IncidentReviewStatus,
  ParticipantStatus,
} from "../../../generated/prisma/enums.js";

import type {
  ContributionCursor,
  ContributionSource,
  RewardTransaction,
} from "../reward.types.js";

const contributionSelect = {
  id: true,
  userId: true,
  type: true,
  incidentId: true,
  sessionAllocationId: true,
  cleanupEventId: true,
  sourceKey: true,
  points: true,
  recordedByUserId: true,
  createdAt: true,
} as const;

export async function findVerifiedIncidentRewardSource(
  database: RewardTransaction,
  incidentId: string,
) {
  return database.incident.findFirst({
    where: {
      id: incidentId,
      reviews: {
        some: { status: IncidentReviewStatus.VALID },
      },
    },
    select: {
      reporterUserId: true,
      reviews: {
        where: { status: IncidentReviewStatus.VALID },
        orderBy: [{ reviewedAt: "asc" }, { id: "asc" }],
        take: 1,
        select: {
          reviewedBy: { select: { userId: true } },
        },
      },
    },
  });
}

export async function findAttendanceRewardSource(
  database: RewardTransaction,
  sessionAllocationId: string,
) {
  return database.sessionAllocation.findFirst({
    where: {
      id: sessionAllocationId,
      status: AllocationStatus.ATTENDED,
      attendanceMarkedAt: { not: null },
    },
    select: {
      participant: { select: { userId: true } },
      attendanceMarkedBy: { select: { userId: true } },
    },
  });
}

export async function findCompletedEventRewardSource(
  database: RewardTransaction,
  cleanupEventId: string,
  participantId: string,
) {
  return database.eventParticipant.findFirst({
    where: {
      id: participantId,
      cleanupEventId,
      status: ParticipantStatus.JOINED,
      cleanupEvent: {
        lifecycleStatus: CleanupLifecycleStatus.COMPLETED,
        completedAt: { not: null },
      },
      allocations: {
        some: {
          status: AllocationStatus.ATTENDED,
          session: { cleanupEventId },
        },
      },
    },
    select: {
      userId: true,
      cleanupEvent: {
        select: {
          createdByMembership: {
            select: { userId: true },
          },
        },
      },
    },
  });
}

function contributionSourceWhere(source: ContributionSource) {
  switch (source.type) {
    case ContributionType.VERIFIED_INCIDENT_REPORT:
      return {
        userId: source.userId,
        type: source.type,
        incidentId: source.incidentId,
      } as const;
    case ContributionType.SESSION_ATTENDED:
      return {
        userId: source.userId,
        type: source.type,
        sessionAllocationId: source.sessionAllocationId,
      } as const;
    case ContributionType.EVENT_COMPLETED:
      return {
        userId: source.userId,
        type: source.type,
        cleanupEventId: source.cleanupEventId,
      } as const;
    case ContributionType.SPECIAL_CONTRIBUTION:
      return {
        userId: source.userId,
        type: source.type,
        sourceKey: source.sourceKey,
      } as const;
  }
}

export async function insertContributionOnce(
  database: RewardTransaction,
  source: ContributionSource,
  points: number,
) {
  const id = randomUUID();
  let insertedCount: number;

  switch (source.type) {
    case ContributionType.VERIFIED_INCIDENT_REPORT:
      insertedCount = await database.$executeRaw`
        INSERT INTO "public"."contribution_events"
          ("id", "user_id", "type", "incident_id", "points", "recorded_by_user_id")
        VALUES
          (${id}::uuid, ${source.userId}::uuid, ${source.type}::"ContributionType", ${source.incidentId}::uuid, ${points}, ${source.recordedByUserId}::uuid)
        ON CONFLICT DO NOTHING
      `;
      break;
    case ContributionType.SESSION_ATTENDED:
      insertedCount = await database.$executeRaw`
        INSERT INTO "public"."contribution_events"
          ("id", "user_id", "type", "session_allocation_id", "points", "recorded_by_user_id")
        VALUES
          (${id}::uuid, ${source.userId}::uuid, ${source.type}::"ContributionType", ${source.sessionAllocationId}::uuid, ${points}, ${source.recordedByUserId}::uuid)
        ON CONFLICT DO NOTHING
      `;
      break;
    case ContributionType.EVENT_COMPLETED:
      insertedCount = await database.$executeRaw`
        INSERT INTO "public"."contribution_events"
          ("id", "user_id", "type", "cleanup_event_id", "points", "recorded_by_user_id")
        VALUES
          (${id}::uuid, ${source.userId}::uuid, ${source.type}::"ContributionType", ${source.cleanupEventId}::uuid, ${points}, ${source.recordedByUserId}::uuid)
        ON CONFLICT DO NOTHING
      `;
      break;
    case ContributionType.SPECIAL_CONTRIBUTION:
      insertedCount = await database.$executeRaw`
        INSERT INTO "public"."contribution_events"
          ("id", "user_id", "type", "source_key", "points", "recorded_by_user_id")
        VALUES
          (${id}::uuid, ${source.userId}::uuid, ${source.type}::"ContributionType", ${source.sourceKey}, ${points}, ${source.recordedByUserId}::uuid)
        ON CONFLICT DO NOTHING
      `;
      break;
  }

  const contribution = await database.contributionEvent.findFirst({
    where: contributionSourceWhere(source),
    select: contributionSelect,
  });

  if (!contribution) {
    throw new Error("The contribution could not be loaded after its idempotent insert.");
  }

  return {
    contribution,
    created: insertedCount === 1,
  };
}

export async function totalContributionPoints(
  database: RewardTransaction,
  userId: string,
): Promise<number> {
  const result = await database.contributionEvent.aggregate({
    where: { userId },
    _sum: { points: true },
  });

  return result._sum.points ?? 0;
}

export async function listQualifyingAchievementDefinitions(
  database: RewardTransaction,
  totalPoints: number,
) {
  return database.achievementDefinition.findMany({
    where: {
      isActive: true,
      thresholdPoints: { not: null, lte: totalPoints },
    },
    orderBy: [{ thresholdPoints: "asc" }, { code: "asc" }],
  });
}

export async function insertUserAchievementOnce(
  database: RewardTransaction,
  input: {
    userId: string;
    achievementId: string;
    contributionId: string;
  },
) {
  const id = randomUUID();
  const insertedCount = await database.$executeRaw`
    INSERT INTO "public"."user_achievements"
      ("id", "user_id", "achievement_id", "awarded_from_contribution_id")
    VALUES
      (${id}::uuid, ${input.userId}::uuid, ${input.achievementId}::uuid, ${input.contributionId}::uuid)
    ON CONFLICT ("user_id", "achievement_id") DO NOTHING
  `;

  return insertedCount === 1 ? id : null;
}

export async function getImpactSummaryRecords(
  prisma: PrismaClient,
  userId: string,
) {
  const [aggregate, breakdown, achievements] = await Promise.all([
    prisma.contributionEvent.aggregate({
      where: { userId },
      _sum: { points: true },
      _count: { _all: true },
    }),
    prisma.contributionEvent.groupBy({
      by: ["type"],
      where: { userId },
      _sum: { points: true },
      _count: { _all: true },
    }),
    prisma.userAchievement.findMany({
      where: { userId },
      orderBy: [{ awardedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        awardedAt: true,
        achievement: {
          select: {
            code: true,
            name: true,
            description: true,
            thresholdPoints: true,
            highlightOnMap: true,
          },
        },
      },
    }),
  ]);

  return { aggregate, breakdown, achievements };
}

export async function listContributionRecords(
  prisma: PrismaClient,
  input: {
    userId: string;
    limit: number;
    cursor: ContributionCursor | null;
  },
) {
  return prisma.contributionEvent.findMany({
    where: {
      userId: input.userId,
      ...(input.cursor
        ? {
            OR: [
              { createdAt: { lt: input.cursor.createdAt } },
              {
                createdAt: input.cursor.createdAt,
                id: { lt: input.cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit + 1,
    select: {
      id: true,
      type: true,
      points: true,
      incidentId: true,
      cleanupEventId: true,
      createdAt: true,
      incident: { select: { title: true } },
      sessionAllocation: {
        select: {
          session: {
            select: {
              sessionDate: true,
              cleanupEvent: { select: { id: true, title: true } },
            },
          },
        },
      },
      cleanupEvent: { select: { title: true } },
    },
  });
}
