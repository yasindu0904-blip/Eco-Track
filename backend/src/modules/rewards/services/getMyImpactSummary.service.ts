import { ContributionType } from "../../../generated/prisma/enums.js";

import {
  CONTRIBUTION_LABELS,
} from "../reward.constants.js";
import type {
  ContributionBreakdownDto,
  ImpactSummaryDto,
} from "../reward.types.js";
import { getImpactSummaryRecords } from "../repositories/reward.repository.js";
import type { RewardDependencies } from "../reward.dependencies.js";

const contributionTypes = Object.values(ContributionType);

export async function getMyImpactSummary(
  dependencies: RewardDependencies,
  userId: string,
): Promise<ImpactSummaryDto> {
  const records = await getImpactSummaryRecords(
    dependencies.prisma,
    userId,
  );
  const grouped = new Map(
    records.breakdown.map((item) => [item.type, item]),
  );
  const breakdown: ContributionBreakdownDto[] = contributionTypes.map((type) => ({
    type,
    label: CONTRIBUTION_LABELS[type],
    points: grouped.get(type)?._sum.points ?? 0,
    count: grouped.get(type)?._count._all ?? 0,
  }));

  return {
    totalPoints: records.aggregate._sum.points ?? 0,
    contributionCount: records.aggregate._count._all,
    breakdown,
    achievements: records.achievements.map((item) => ({
      id: item.id,
      code: item.achievement.code,
      name: item.achievement.name,
      description: item.achievement.description,
      thresholdPoints: item.achievement.thresholdPoints,
      highlightOnMap: item.achievement.highlightOnMap,
      awardedAt: item.awardedAt.toISOString(),
    })),
  };
}
