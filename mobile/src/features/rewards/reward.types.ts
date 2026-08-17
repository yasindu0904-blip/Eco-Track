export type ContributionType =
  | "VERIFIED_INCIDENT_REPORT"
  | "SESSION_ATTENDED"
  | "EVENT_COMPLETED"
  | "SPECIAL_CONTRIBUTION";

export type Achievement = {
  id: string;
  code: string;
  name: string;
  description: string;
  thresholdPoints: number | null;
  highlightOnMap: boolean;
  awardedAt: string;
};

export type ContributionBreakdown = {
  type: ContributionType;
  label: string;
  points: number;
  count: number;
};

export type ImpactSummary = {
  totalPoints: number;
  contributionCount: number;
  breakdown: ContributionBreakdown[];
  achievements: Achievement[];
};

export type Contribution = {
  id: string;
  type: ContributionType;
  label: string;
  points: number;
  reason: string;
  incidentId: string | null;
  cleanupEventId: string | null;
  createdAt: string;
};

export type ContributionPage = {
  items: Contribution[];
  nextCursor: string | null;
};
