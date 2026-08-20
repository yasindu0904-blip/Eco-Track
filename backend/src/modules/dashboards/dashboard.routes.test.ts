import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

import express from "express";

import { errorMiddleware } from "../../middleware/error.middleware.js";
import type {
  AuthenticatedUserProfile,
  AuthenticationDependencies,
} from "../auth/auth.types.js";
import { createDashboardRouter } from "./dashboard.routes.js";

const citizenId = randomUUID();
const citizenAuthId = randomUUID();
const superAdminId = randomUUID();
const superAdminAuthId = randomUUID();
const incompleteUserId = randomUUID();
const incompleteAuthId = randomUUID();
const organizationAId = randomUUID();
const organizationBId = randomUUID();

function profile(
  id: string,
  platformRole: "USER" | "SUPER_ADMIN",
  profileCompletedAt: Date | null = new Date(),
): AuthenticatedUserProfile {
  return {
    id,
    email: `${id}@test.local`,
    fullName: profileCompletedAt ? "Test User" : null,
    phoneNumber: profileCompletedAt ? "+94770000000" : null,
    profileCompletedAt,
    platformRole,
    accountStatus: "ACTIVE",
  };
}

const profiles = {
  citizen: profile(citizenId, "USER"),
  superAdmin: profile(superAdminId, "SUPER_ADMIN"),
  incomplete: profile(incompleteUserId, "USER", null),
};

const authenticationDependencies: AuthenticationDependencies = {
  async verifyAccessToken(token) {
    if (token === "citizen") {
      return {
        authUserId: citizenAuthId,
        email: profiles.citizen.email,
      };
    }

    if (token === "super-admin") {
      return {
        authUserId: superAdminAuthId,
        email: profiles.superAdmin.email,
      };
    }

    if (token === "incomplete") {
      return {
        authUserId: incompleteAuthId,
        email: profiles.incomplete.email,
      };
    }

    return null;
  },
  async provisionOrSynchronizeProfile(identity) {
    if (identity.authUserId === superAdminAuthId) {
      return profiles.superAdmin;
    }

    if (identity.authUserId === incompleteAuthId) {
      return profiles.incomplete;
    }

    return profiles.citizen;
  },
};

const prisma = {
  incident: {
    groupBy: async ({ where }: { where: { reporterUserId?: string } }) => [
      {
        status: where.reporterUserId ? "ACTIVE" : "RESOLVED",
        _count: where.reporterUserId === citizenId ? 2 : 8,
      },
    ],
  },
  eventParticipant: { count: async () => 0 },
  notification: { count: async () => 0 },
  contributionEvent: {
    aggregate: async () => ({
      _count: 0,
      _sum: { points: null },
    }),
  },
  userProfile: { count: async () => 2 },
  organization: {
    count: async () => 0,
    groupBy: async () => [],
  },
  cleanupEvent: { groupBy: async () => [] },
  incidentReview: {
    groupBy: async ({ where }: { where: { organizationId: string } }) => [
      {
        status: "VIEWED",
        _count: where.organizationId === organizationAId ? 1 : 99,
      },
    ],
  },
  eventSession: { count: async () => 0 },
  organizationMembershipRequest: { count: async () => 0 },
  $queryRaw: async () => [{ status: "ACTIVE", count: 3n }],
};

let server: Server | undefined;
let baseUrl = "";

before(async () => {
  const app = express();

  app.use(
    createDashboardRouter(
      authenticationDependencies,
      {
        prisma: prisma as never,
        authorization: {
          async findActiveTenantContext(userId, organizationId) {
            if (
              userId !== citizenId ||
              organizationId !== organizationAId
            ) {
              return null;
            }

            return {
              organization: {
                id: organizationId,
                status: "ACTIVE",
              },
              membership: {
                id: randomUUID(),
                organizationId,
                userId,
                role: "ORG_ADMIN",
                status: "ACTIVE",
              },
            };
          },
          async findEventAuthorizationContext() {
            return null;
          },
        },
      },
    ),
  );
  app.use(errorMiddleware);

  server = app.listen(0);
  await new Promise<void>((resolve) => {
    server?.once("listening", resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server?.close((error) => (error ? reject(error) : resolve()));
  });
});

function get(token: string, path: string) {
  return fetch(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

test("citizen and platform routes use the CASL dashboard contract", async () => {
  const citizen = await get("citizen", "/dashboards/citizen");
  assert.equal(citizen.status, 200);
  assert.deepEqual(
    ((await citizen.json()) as { data: { reportsByState: unknown } }).data
      .reportsByState,
    { ACTIVE: 2 },
  );

  assert.equal(
    (await get("super-admin", "/dashboards/citizen")).status,
    403,
  );
  assert.equal(
    (await get("citizen", "/dashboards/platform")).status,
    403,
  );

  const platform = await get("super-admin", "/dashboards/platform");
  assert.equal(platform.status, 200);
  assert.equal(
    ((await platform.json()) as { data: { users: { total: number } } }).data
      .users.total,
    2,
  );
});

test("organization route requires the exact active tenant", async () => {
  const allowed = await get(
    "citizen",
    `/organizations/${organizationAId}/dashboard-summary`,
  );
  assert.equal(allowed.status, 200);
  assert.equal(
    ((await allowed.json()) as {
      data: { reviewsByState: Record<string, number> };
    }).data.reviewsByState.VIEWED,
    1,
  );

  assert.equal(
    (
      await get(
        "citizen",
        `/organizations/${organizationBId}/dashboard-summary`,
      )
    ).status,
    403,
  );
});

test("dashboard routes reject missing authentication and incomplete profiles", async () => {
  assert.equal((await fetch(`${baseUrl}/dashboards/citizen`)).status, 401);
  assert.equal(
    (await get("incomplete", "/dashboards/citizen")).status,
    403,
  );
});

test("dashboard routes reject unsafe date ranges", async () => {
  const response = await get(
    "citizen",
    "/dashboards/citizen?from=2026-01-01T00:00:00Z",
  );

  assert.equal(response.status, 400);
});
