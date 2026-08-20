import assert from "node:assert/strict";
import test from "node:test";

import {
  getCitizenDashboardSummaryRecords,
  getPlatformDashboardSummaryRecords,
} from "./repositories/dashboard.repository.js";

test("citizen aggregates scope every private query to the authenticated user", async () => {
  const userId = "user-a";
  const seen: unknown[] = [];
  const prisma = {
    incident: {
      groupBy: async (query: unknown) => {
        seen.push(query);
        return [{ status: "ACTIVE", _count: 2 }];
      },
    },
    eventParticipant: {
      count: async (query: unknown) => {
        seen.push(query);
        return 3;
      },
    },
    notification: {
      count: async (query: unknown) => {
        seen.push(query);
        return 4;
      },
    },
    contributionEvent: {
      aggregate: async (query: unknown) => {
        seen.push(query);
        return {
          _count: 5,
          _sum: { points: 25 },
        };
      },
    },
  };

  const result = await getCitizenDashboardSummaryRecords(
    prisma as never,
    userId,
    {},
  );

  assert.deepEqual(result.reportsByState, { ACTIVE: 2 });
  assert.equal(result.contributions.points, 25);
  assert.ok(
    seen.every((query) => {
      const serialized = JSON.stringify(query);
      return (
        serialized.includes(`"userId":"${userId}"`) ||
        serialized.includes(`"reporterUserId":"${userId}"`)
      );
    }),
  );
});

test("platform summary returns aggregates without record collections", async () => {
  const prisma = {
    userProfile: {
      count: async () => 10,
    },
    organization: {
      count: async () => 1,
      groupBy: async () => [{ status: "ACTIVE", _count: 2 }],
    },
    incident: {
      groupBy: async () => [{ status: "ACTIVE", _count: 3 }],
    },
    cleanupEvent: {
      groupBy: async () => [
        { lifecycleStatus: "PUBLISHED", _count: 4 },
      ],
    },
  };

  const result = await getPlatformDashboardSummaryRecords(
    prisma as never,
    {},
  );

  assert.deepEqual(result.organizationsByState, { ACTIVE: 2 });
  assert.equal(result.eventsByLifecycle.PUBLISHED, 4);
  assert.equal("items" in result, false);
});
