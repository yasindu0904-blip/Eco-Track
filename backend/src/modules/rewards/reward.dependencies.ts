import { prisma } from "../../database/prisma.js";

import type { RewardReadDatabase } from "./reward.types.js";

export type RewardDependencies = {
  prisma: RewardReadDatabase;
};

export const rewardDependencies: RewardDependencies = {
  prisma,
};
