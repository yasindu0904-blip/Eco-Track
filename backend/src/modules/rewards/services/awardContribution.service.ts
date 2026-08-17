import { ApplicationError } from "../../../errors/applicationError.js";
import {
  ContributionType,
  NotificationType,
} from "../../../generated/prisma/enums.js";
import { createNotification } from "../../notifications/services/createNotification.service.js";

import { CONTRIBUTION_POINTS } from "../reward.constants.js";
import type {
  AwardContributionResult,
  ContributionSource,
  RewardTransaction,
} from "../reward.types.js";
import { specialContributionSourceKeySchema } from "../reward.validation.js";
import {
  findAttendanceRewardSource,
  findCompletedEventRewardSource,
  findVerifiedIncidentRewardSource,
  insertContributionOnce,
  insertUserAchievementOnce,
  listQualifyingAchievementDefinitions,
  totalContributionPoints,
} from "../repositories/reward.repository.js";

async function awardContribution(
  transaction: RewardTransaction,
  source: ContributionSource,
): Promise<AwardContributionResult> {
  const points = CONTRIBUTION_POINTS[source.type];
  const { contribution, created } = await insertContributionOnce(
    transaction,
    source,
    points,
  );

  if (!created) {
    return {
      contributionId: contribution.id,
      userId: contribution.userId,
      type: contribution.type,
      points: contribution.points,
      created: false,
      newAchievementIds: [],
    };
  }

  const totalPoints = await totalContributionPoints(
    transaction,
    contribution.userId,
  );
  const qualifyingAchievements =
    await listQualifyingAchievementDefinitions(
      transaction,
      totalPoints,
    );
  const newAchievementIds: string[] = [];

  for (const achievement of qualifyingAchievements) {
    const userAchievementId = await insertUserAchievementOnce(
      transaction,
      {
        userId: contribution.userId,
        achievementId: achievement.id,
        contributionId: contribution.id,
      },
    );

    if (!userAchievementId) {
      continue;
    }

    newAchievementIds.push(userAchievementId);
    await createNotification(
      { prisma: transaction },
      {
        userId: contribution.userId,
        type: NotificationType.ACHIEVEMENT_AWARDED,
        title: `Achievement earned: ${achievement.name}`,
        message: `${achievement.description} Your EcoTrack rewards are non-monetary and do not change your access permissions.`,
        data: { achievementId: achievement.id },
      },
    );
  }

  return {
    contributionId: contribution.id,
    userId: contribution.userId,
    type: contribution.type,
    points: contribution.points,
    created: true,
    newAchievementIds,
  };
}

export async function awardVerifiedIncidentReportContribution(
  transaction: RewardTransaction,
  incidentId: string,
): Promise<AwardContributionResult> {
  const source = await findVerifiedIncidentRewardSource(
    transaction,
    incidentId,
  );

  if (!source) {
    throw new ApplicationError(
      409,
      "INCIDENT_NOT_VERIFIED",
      "Verified-report points require an authorized VALID organization review.",
    );
  }

  return awardContribution(transaction, {
    type: ContributionType.VERIFIED_INCIDENT_REPORT,
    userId: source.reporterUserId,
    incidentId,
    recordedByUserId: source.reviews[0]?.reviewedBy.userId ?? null,
  });
}

export async function awardSessionAttendanceContribution(
  transaction: RewardTransaction,
  sessionAllocationId: string,
): Promise<AwardContributionResult> {
  const source = await findAttendanceRewardSource(
    transaction,
    sessionAllocationId,
  );

  if (!source) {
    throw new ApplicationError(
      409,
      "SESSION_ATTENDANCE_NOT_CONFIRMED",
      "Attendance points require an allocation marked ATTENDED by an authorized organization user.",
    );
  }

  return awardContribution(transaction, {
    type: ContributionType.SESSION_ATTENDED,
    userId: source.participant.userId,
    sessionAllocationId,
    recordedByUserId: source.attendanceMarkedBy?.userId ?? null,
  });
}

export async function awardCompletedEventContribution(
  transaction: RewardTransaction,
  input: {
    cleanupEventId: string;
    participantId: string;
  },
): Promise<AwardContributionResult> {
  const source = await findCompletedEventRewardSource(
    transaction,
    input.cleanupEventId,
    input.participantId,
  );

  if (!source) {
    throw new ApplicationError(
      409,
      "EVENT_COMPLETION_NOT_CONFIRMED",
      "Event-completion points require a completed event and confirmed session attendance.",
    );
  }

  return awardContribution(transaction, {
    type: ContributionType.EVENT_COMPLETED,
    userId: source.userId,
    cleanupEventId: input.cleanupEventId,
    recordedByUserId: source.cleanupEvent.createdByMembership.userId,
  });
}

export async function awardApprovedSpecialContribution(
  transaction: RewardTransaction,
  input: {
    recipientUserId: string;
    approvedByUserId: string;
    approvalSourceKey: string;
  },
): Promise<AwardContributionResult> {
  const validation = specialContributionSourceKeySchema.safeParse(
    input.approvalSourceKey,
  );

  if (!validation.success) {
    throw new ApplicationError(
      500,
      "SPECIAL_CONTRIBUTION_SOURCE_INVALID",
      "A trusted approved special contribution requires a stable source key.",
    );
  }

  return awardContribution(transaction, {
    type: ContributionType.SPECIAL_CONTRIBUTION,
    userId: input.recipientUserId,
    sourceKey: validation.data,
    recordedByUserId: input.approvedByUserId,
  });
}
