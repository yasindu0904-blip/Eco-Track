import { ContributionType } from "../../generated/prisma/enums.js";

export const CONTRIBUTION_POINTS = {
  [ContributionType.VERIFIED_INCIDENT_REPORT]: 20,
  [ContributionType.SESSION_ATTENDED]: 10,
  [ContributionType.EVENT_COMPLETED]: 30,
  [ContributionType.SPECIAL_CONTRIBUTION]: 25,
} as const satisfies Record<ContributionType, number>;

export const CONTRIBUTION_LABELS = {
  [ContributionType.VERIFIED_INCIDENT_REPORT]: "Verified incident report",
  [ContributionType.SESSION_ATTENDED]: "Cleanup session attended",
  [ContributionType.EVENT_COMPLETED]: "Cleanup event completed",
  [ContributionType.SPECIAL_CONTRIBUTION]: "Approved special contribution",
} as const satisfies Record<ContributionType, string>;

export const REWARD_LIST_LIMITS = {
  defaultLimit: 20,
  maxLimit: 50,
} as const;
