import type {
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client.js";
import type { ContributionType } from "../../generated/prisma/enums.js";

export type RewardTransaction = Prisma.TransactionClient;
export type RewardReadDatabase = PrismaClient;

export type ContributionCursor = {
  createdAt: Date;
  id: string;
};

export type AchievementDto = {
  id: string;
  code: string;
  name: string;
  description: string;
  thresholdPoints: number | null;
  highlightOnMap: boolean;
  awardedAt: string;
};

export type ContributionBreakdownDto = {
  type: ContributionType;
  label: string;
  points: number;
  count: number;
};

export type ImpactSummaryDto = {
  totalPoints: number;
  contributionCount: number;
  breakdown: ContributionBreakdownDto[];
  achievements: AchievementDto[];
};

export type ContributionDto = {
  id: string;
  type: ContributionType;
  label: string;
  points: number;
  reason: string;
  incidentId: string | null;
  cleanupEventId: string | null;
  createdAt: string;
};

export type ContributionPageDto = {
  items: ContributionDto[];
  nextCursor: string | null;
};

export type AwardContributionResult = {
  contributionId: string;
  userId: string;
  type: ContributionType;
  points: number;
  created: boolean;
  newAchievementIds: string[];
};

export type ContributionSource =
  | {
      type: "VERIFIED_INCIDENT_REPORT";
      userId: string;
      incidentId: string;
      recordedByUserId: string | null;
    }
  | {
      type: "SESSION_ATTENDED";
      userId: string;
      sessionAllocationId: string;
      recordedByUserId: string | null;
    }
  | {
      type: "EVENT_COMPLETED";
      userId: string;
      cleanupEventId: string;
      recordedByUserId: string | null;
    }
  | {
      type: "SPECIAL_CONTRIBUTION";
      userId: string;
      sourceKey: string;
      recordedByUserId: string;
    };
