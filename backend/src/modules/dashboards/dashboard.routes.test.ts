import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";
import express from "express";
import { createDashboardRouter } from "./dashboard.routes.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
import type { AuthenticatedUserProfile } from "../auth/auth.types.js";

const citizenId = randomUUID(), adminId = randomUUID(), citizenAuthId = randomUUID(), adminAuthId = randomUUID(), organizationA = randomUUID(), organizationB = randomUUID();
const profile = (id: string, role: "USER" | "SUPER_ADMIN"): AuthenticatedUserProfile => ({ id, email: `${id}@test.local`, fullName: "Test User", phoneNumber: "+94770000000", profileCompletedAt: new Date(), platformRole: role, accountStatus: "ACTIVE" });
const profiles = { citizen: profile(citizenId, "USER"), admin: profile(adminId, "SUPER_ADMIN") };
let server: Server, baseUrl: string;

before(async () => {
  const prisma = {
    incident: { groupBy: async ({ where }: any) => [{ status: where.reporterUserId ? "ACTIVE" : "RESOLVED", _count: where.reporterUserId === citizenId ? 2 : 8 }] },
    eventParticipant: { count: async () => 0 }, notification: { count: async () => 0 }, contributionEvent: { aggregate: async () => ({ _count: 0, _sum: { points: null } }) },
    userProfile: { count: async () => 2 }, organization: { count: async () => 0, groupBy: async () => [] }, cleanupEvent: { groupBy: async () => [] },
    incidentReview: { groupBy: async ({ where }: any) => [{ status: "VIEWED", _count: where.organizationId === organizationA ? 1 : 99 }] },
    eventSession: { count: async () => 0 }, organizationMembershipRequest: { count: async () => 0 },
    $queryRaw: async () => [{ status: "ACTIVE", count: 3n }],
  };
  const app = express();
  app.use(createDashboardRouter({ verifyAccessToken: async token => token === "citizen" ? { authUserId: citizenAuthId, email: profiles.citizen.email } : token === "admin" ? { authUserId: adminAuthId, email: profiles.admin.email } : null, provisionOrSynchronizeProfile: async identity => identity.authUserId === adminAuthId ? profiles.admin : profiles.citizen }, { prisma: prisma as never, authorization: { findActiveTenantContext: async (userId, id) => userId === citizenId && id === organizationA ? { organization: { id, status: "ACTIVE" }, membership: { id: randomUUID(), organizationId: id, userId, role: "ORG_ADMIN", status: "ACTIVE" } } : null, findEventAuthorizationContext: async () => null } }));
  app.use(errorMiddleware);
  server = app.listen(0); await new Promise<void>(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
const get = (token: string, path: string) => fetch(baseUrl + path, { headers: { authorization: `Bearer ${token}` } });

test("citizen and platform routes enforce roles and return aggregates", async () => {
  const citizen = await get("citizen", "/dashboards/citizen"); assert.equal(citizen.status, 200); assert.deepEqual((await citizen.json() as any).data.reportsByState, { ACTIVE: 2 });
  assert.equal((await get("admin", "/dashboards/citizen")).status, 403);
  assert.equal((await get("citizen", "/dashboards/platform")).status, 403);
  const platform = await get("admin", "/dashboards/platform"); assert.equal(platform.status, 200); assert.equal((await platform.json() as any).data.users.total, 2);
});

test("organization route requires an active membership in that exact tenant", async () => {
  const allowed = await get("citizen", `/organizations/${organizationA}/dashboard-summary`); assert.equal(allowed.status, 200); assert.equal((await allowed.json() as any).data.reviewsByState.VIEWED, 1);
  assert.equal((await get("citizen", `/organizations/${organizationB}/dashboard-summary`)).status, 403);
});
