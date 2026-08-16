import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

import express from "express";

import { prisma } from "../../../database/prisma.js";
import {
  AccountStatus,
  MembershipRequestStatus,
  MembershipRole,
  MembershipSource,
  MembershipStatus,
  OrganizationStatus,
  PlatformRole,
} from "../../../generated/prisma/enums.js";
import { errorMiddleware } from "../../../middleware/error.middleware.js";
import type { AuthenticationDependencies } from "../../auth/auth.types.js";
import { membershipSelfServiceDependencies } from "./membershipSelfService.dependencies.js";
import { createMembershipSelfServiceRouter } from "./membershipSelfService.routes.js";
import type {
  MembershipRequestDto,
  MembershipRequestPageDto,
  OrganizationSearchPageDto,
} from "./membershipSelfService.types.js";

const runId = randomUUID().slice(0, 8);
const ids = {
  citizenA: randomUUID(),
  citizenB: randomUUID(),
  incomplete: randomUUID(),
  suspended: randomUUID(),
  adminA: randomUUID(),
  memberA: randomUUID(),
  suspendedAdmin: randomUUID(),
  adminB: randomUUID(),
  activeA: randomUUID(),
  activeB: randomUUID(),
  inactive: randomUUID(),
  declinedRequest: randomUUID(),
};

const authIds = new Map<string, string>([
  ["citizen-a", randomUUID()],
  ["citizen-b", randomUUID()],
  ["incomplete", randomUUID()],
  ["suspended", randomUUID()],
]);

const tokenToUser = new Map<string, keyof typeof ids>([
  ["citizen-a-token", "citizenA"],
  ["citizen-b-token", "citizenB"],
  ["incomplete-token", "incomplete"],
  ["suspended-token", "suspended"],
]);

const authenticationDependencies: AuthenticationDependencies = {
  async verifyAccessToken(token) {
    const userKey = tokenToUser.get(token);
    const authUserId = userKey ? authIds.get(userKey.replace("citizenA", "citizen-a").replace("citizenB", "citizen-b")) : undefined;

    if (!userKey || !authUserId) {
      return null;
    }

    return { authUserId, email: `${userKey}-${runId}@example.test` };
  },
  async provisionOrSynchronizeProfile(identity) {
    const profile = await prisma.userProfile.findUniqueOrThrow({
      where: { authUserId: identity.authUserId },
    });

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      phoneNumber: profile.phoneNumber,
      profileCompletedAt: profile.profileCompletedAt,
      platformRole: profile.platformRole,
      accountStatus: profile.accountStatus,
    };
  },
};

let server: Server | undefined;
let baseUrl = "";

function api(token: string, path: string, options: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...options.headers,
    },
  });
}

before(async () => {
  await prisma.userProfile.createMany({
    data: [
      { id: ids.citizenA, authUserId: authIds.get("citizen-a")!, email: `citizen-a-${runId}@example.test`, fullName: "Citizen A", phoneNumber: "+94770000001", profileCompletedAt: new Date() },
      { id: ids.citizenB, authUserId: authIds.get("citizen-b")!, email: `citizen-b-${runId}@example.test`, fullName: "Citizen B", phoneNumber: "+94770000002", profileCompletedAt: new Date() },
      { id: ids.incomplete, authUserId: authIds.get("incomplete")!, email: `incomplete-${runId}@example.test` },
      { id: ids.suspended, authUserId: authIds.get("suspended")!, email: `suspended-${runId}@example.test`, fullName: "Suspended", phoneNumber: "+94770000003", profileCompletedAt: new Date(), accountStatus: AccountStatus.SUSPENDED },
      { id: ids.adminA, authUserId: randomUUID(), email: `admin-a-${runId}@example.test`, fullName: "Admin A", phoneNumber: "+94770000004", profileCompletedAt: new Date() },
      { id: ids.memberA, authUserId: randomUUID(), email: `member-a-${runId}@example.test`, fullName: "Member A", phoneNumber: "+94770000005", profileCompletedAt: new Date() },
      { id: ids.suspendedAdmin, authUserId: randomUUID(), email: `suspended-admin-${runId}@example.test`, fullName: "Suspended Admin", phoneNumber: "+94770000006", profileCompletedAt: new Date(), accountStatus: AccountStatus.SUSPENDED },
      { id: ids.adminB, authUserId: randomUUID(), email: `admin-b-${runId}@example.test`, fullName: "Admin B", phoneNumber: "+94770000007", profileCompletedAt: new Date() },
    ],
  });

  await prisma.organization.createMany({
    data: [
      { id: ids.activeA, requestedByUserId: ids.adminA, name: `ACC01 Alpha ${runId}`, slug: `acc01-alpha-${runId}`, description: "Active organization A", officialEmail: `alpha-${runId}@example.test`, officialPhone: "+94110000001", officialAddress: "Alpha address", status: OrganizationStatus.ACTIVE, activatedAt: new Date() },
      { id: ids.activeB, requestedByUserId: ids.adminB, name: `ACC01 Beta ${runId}`, slug: `acc01-beta-${runId}`, description: "Active organization B", officialEmail: `beta-${runId}@example.test`, officialPhone: "+94110000002", officialAddress: "Beta address", status: OrganizationStatus.ACTIVE, activatedAt: new Date() },
      { id: ids.inactive, requestedByUserId: ids.adminA, name: `ACC01 Hidden ${runId}`, slug: `acc01-hidden-${runId}`, description: "Suspended organization", officialEmail: `hidden-${runId}@example.test`, officialPhone: "+94110000003", officialAddress: "Hidden address", status: OrganizationStatus.SUSPENDED },
    ],
  });

  await prisma.organizationMembership.createMany({
    data: [
      { organizationId: ids.activeA, userId: ids.adminA, role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE, source: MembershipSource.FIRST_ADMIN },
      { organizationId: ids.activeA, userId: ids.memberA, role: MembershipRole.ORG_MEMBER, status: MembershipStatus.ACTIVE, source: MembershipSource.ADMIN_ADDED },
      { organizationId: ids.activeA, userId: ids.suspendedAdmin, role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE, source: MembershipSource.ADMIN_ADDED },
      { organizationId: ids.activeB, userId: ids.adminB, role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE, source: MembershipSource.FIRST_ADMIN },
      { organizationId: ids.activeB, userId: ids.citizenA, role: MembershipRole.ORG_MEMBER, status: MembershipStatus.ACTIVE, source: MembershipSource.ADMIN_ADDED },
    ],
  });

  await prisma.organizationMembershipRequest.create({
    data: {
      id: ids.declinedRequest,
      organizationId: ids.inactive,
      requesterUserId: ids.citizenA,
      status: MembershipRequestStatus.DECLINED,
      reviewedAt: new Date(),
      reviewNotes: "Not eligible",
    },
  });

  const app = express();
  app.use(express.json());
  app.use(
    "/api/v1",
    createMembershipSelfServiceRouter(
      authenticationDependencies,
      membershipSelfServiceDependencies,
    ),
  );
  app.use(errorMiddleware);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server?.address() as AddressInfo).port}/api/v1`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server?.close((error) => (error ? reject(error) : resolve())),
    );
  }

  const organizationIds = [ids.activeA, ids.activeB, ids.inactive];
  const userIds = [ids.citizenA, ids.citizenB, ids.incomplete, ids.suspended, ids.adminA, ids.memberA, ids.suspendedAdmin, ids.adminB];
  await prisma.notification.deleteMany({ where: { OR: [{ organizationId: { in: organizationIds } }, { userId: { in: userIds } }] } });
  await prisma.auditLog.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationMembershipRequest.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
  await prisma.userProfile.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test("routes require authentication, completed profiles, and active accounts", async () => {
  assert.equal((await fetch(`${baseUrl}/organizations`)).status, 401);
  assert.equal((await api("incomplete-token", "/organizations")).status, 403);
  assert.equal((await api("suspended-token", "/organizations")).status, 403);
});

test("active organization search exposes safe fields and stable pagination", async () => {
  const first = await api("citizen-a-token", `/organizations?query=ACC01&limit=1`);
  assert.equal(first.status, 200);
  const firstBody = (await first.json()) as { data: OrganizationSearchPageDto };
  assert.equal(firstBody.data.items.length, 1);
  assert.deepEqual(Object.keys(firstBody.data.items[0]!).sort(), ["description", "id", "name", "slug"]);
  assert.ok(firstBody.data.nextCursor);

  const second = await api("citizen-a-token", `/organizations?query=ACC01&limit=1&cursor=${encodeURIComponent(firstBody.data.nextCursor!)}`);
  const secondBody = (await second.json()) as { data: OrganizationSearchPageDto };
  assert.equal(secondBody.data.items.length, 1);
  assert.equal(new Set([...firstBody.data.items, ...secondBody.data.items].map(({ id }) => id)).size, 2);
  assert.equal([...firstBody.data.items, ...secondBody.data.items].some(({ id }) => id === ids.inactive), false);
  assert.equal((await api("citizen-a-token", "/organizations?cursor=invalid")).status, 400);
});

test("creation permits ORG_MEMBER intent only and rejects inactive organizations and existing members", async () => {
  const roleManipulation = await api("citizen-a-token", "/organization-membership-requests", {
    method: "POST",
    body: JSON.stringify({ organizationId: ids.activeA, role: "ORG_ADMIN" }),
  });
  assert.equal(roleManipulation.status, 400);

  const inactive = await api("citizen-a-token", "/organization-membership-requests", {
    method: "POST",
    body: JSON.stringify({ organizationId: ids.inactive }),
  });
  assert.equal(inactive.status, 404);

  const existingMember = await api("citizen-a-token", "/organization-membership-requests", {
    method: "POST",
    body: JSON.stringify({ organizationId: ids.activeB }),
  });
  assert.equal(existingMember.status, 409);
});

test("submission creates one pending request, safe admin notifications, and rejects duplicates", async () => {
  const created = await api("citizen-a-token", "/organization-membership-requests", {
    method: "POST",
    body: JSON.stringify({ organizationId: ids.activeA, message: "I volunteer locally." }),
  });
  assert.equal(created.status, 201);
  const body = (await created.json()) as { data: MembershipRequestDto };
  assert.equal(body.data.status, MembershipRequestStatus.PENDING);
  assert.equal(body.data.organization.id, ids.activeA);

  const duplicate = await api("citizen-a-token", "/organization-membership-requests", {
    method: "POST",
    body: JSON.stringify({ organizationId: ids.activeA }),
  });
  assert.equal(duplicate.status, 409);

  const notifications = await prisma.notification.findMany({
    where: { data: { path: ["membershipRequestId"], equals: body.data.id } },
    orderBy: { userId: "asc" },
  });
  assert.deepEqual(notifications.map(({ userId }) => userId), [ids.adminA]);
  assert.equal(notifications[0]?.message.includes("Citizen A"), false);
  assert.deepEqual(Object.keys((notifications[0]?.data ?? {}) as object).sort(), ["membershipRequestId", "organizationId", "status"]);
});

test("the database-backed pending constraint makes concurrent duplicate requests safe", async () => {
  const responses = await Promise.all([
    api("citizen-b-token", "/organization-membership-requests", { method: "POST", body: JSON.stringify({ organizationId: ids.activeA }) }),
    api("citizen-b-token", "/organization-membership-requests", { method: "POST", body: JSON.stringify({ organizationId: ids.activeA }) }),
  ]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);
  assert.equal(await prisma.organizationMembershipRequest.count({ where: { organizationId: ids.activeA, requesterUserId: ids.citizenB, status: MembershipRequestStatus.PENDING } }), 1);
});

test("request history is requester-owned and withdrawal is pending-only", async () => {
  const citizenBRequest = await prisma.organizationMembershipRequest.findFirstOrThrow({
    where: { organizationId: ids.activeA, requesterUserId: ids.citizenB, status: MembershipRequestStatus.PENDING },
  });

  assert.equal((await api("citizen-a-token", `/organization-membership-requests/me/${citizenBRequest.id}`)).status, 404);
  assert.equal((await api("citizen-a-token", `/organization-membership-requests/me/${citizenBRequest.id}/withdraw`, { method: "PATCH" })).status, 404);

  const own = await api("citizen-b-token", `/organization-membership-requests/me/${citizenBRequest.id}`);
  assert.equal(own.status, 200);
  const withdrawn = await api("citizen-b-token", `/organization-membership-requests/me/${citizenBRequest.id}/withdraw`, { method: "PATCH" });
  assert.equal(withdrawn.status, 200);
  assert.equal(((await withdrawn.json()) as { data: MembershipRequestDto }).data.status, MembershipRequestStatus.WITHDRAWN);
  assert.equal((await api("citizen-b-token", `/organization-membership-requests/me/${citizenBRequest.id}/withdraw`, { method: "PATCH" })).status, 409);
  assert.equal((await api("citizen-a-token", `/organization-membership-requests/me/${ids.declinedRequest}/withdraw`, { method: "PATCH" })).status, 409);

  const history = await api("citizen-a-token", "/organization-membership-requests/me?limit=20");
  const historyBody = (await history.json()) as { data: MembershipRequestPageDto };
  assert.equal(historyBody.data.items.some(({ id, status }) => id === ids.declinedRequest && status === MembershipRequestStatus.DECLINED), true);
});
