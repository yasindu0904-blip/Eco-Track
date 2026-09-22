import { after } from "node:test";

import { closeRedisRuntime } from "../config/redisRuntime.js";
import { prisma } from "../database/prisma.js";

// Register after suite-specific hooks so fixture cleanup finishes first.
export function registerResourceCleanup(): void {
  after(async () => {
    try {
      await closeRedisRuntime();
    } finally {
      await prisma.$disconnect();
    }
  });
}
