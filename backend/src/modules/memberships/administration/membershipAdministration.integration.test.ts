import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

import { createApp } from "../../../app.js";
import { authorizationDependencies } from "../../../authorization/authorization.dependencies.js";
import { prisma } from "../../../database/prisma.js";
import {
  AccountStatus,
  MembershipRequestStatus,
  MembershipRole,
  MembershipSource,
  MembershipStatus,
  OrganizationStatus,
} from "../../../generated/prisma/enums.js";
import type { AuthenticationDependencies } from "../../auth/auth.types.js";
import { membershipAdministrationDependencies } from "./membershipAdministration.dependencies.js";
import type {
  ActiveOrganizationMembershipPageDto,
  AdminMembershipRequestDto,
  AdminMembershipRequestPageDto,
  OrganizationMemberDto,
  OrganizationMemberPageDto,
} from "./membershipAdministration.types.js";

const runId = randomUUID().slice(0, 8);
const ids = {
  adminA: randomUUID(),
  adminA2: randomUUID(),
  memberA: randomUUID(),
  adminB: randomUUID(),
  memberB: randomUUID(),
  adminC: randomUUID(),
  approveUser: randomUUID(),
  declineUser: randomUUID(),
  raceUser: randomUUID(),
  addUser: randomUUID(),
  pendingAddUser: randomUUID(),
  incompleteUser: randomUUID(),
  organizationA: randomUUID(),
  organizationB: randomUUID(),
  organizationC: randomUUID(),
  adminAMembership: randomUUID(),
  adminA2Membership: randomUUID(),
  memberAMembership: randomUUID(),
  adminAInBMembership: randomUUID(),
  adminAInCMembership: randomUUID(),
  adminBMembership: randomUUID(),
  memberBMembership: randomUUID(),
  adminCMembership: randomUUID(),
  approveRequest: randomUUID(),
  declineRequest: randomUUID(),
  raceRequest: randomUUID(),
  pendingAddRequest: randomUUID(),
  requestB: randomUUID(),
};

const authIds = new Map<string, string>();
const tokenToUserId = new Map<string, string>();
for (const [token, userId] of [
  ["admin-a-token", ids.adminA],
  ["admin-a2-token", ids.adminA2],
  ["member-a-token", ids.memberA],
  ["admin-b-token", ids.adminB],
  ["admin-c-token", ids.adminC],
  ["incomplete-token", ids.incompleteUser],
] as const) {
  const authUserId = randomUUID();
  authIds.set(userId, authUserId);
  tokenToUserId.set(token, userId);
}

const authenticationDependencies: AuthenticationDependencies = {
  async verifyAccessToken(token) {
    const userId = tokenToUserId.get(token);
    const authUserId = userId ? authIds.get(userId) : undefined;
    return userId && authUserId
      ? { authUserId, email: `${userId}-${runId}@example.test` }
      : null;
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
  return fetch(`${baseUrl}/api/v1${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...options.headers,
    },
  });
}

function profileData(id: string, name: string, complete = true) {
  return {
    id,
    authUserId: authIds.get(id) ?? randomUUID(),
    email: `${name.toLowerCase().replaceAll(" ", "-")}-${runId}@example.test`,
    fullName: complete ? name : null,
    phoneNumber: complete ? "+94770000001" : null,
    profileCompletedAt: complete ? new Date() : null,
  };
}

before(async () => {
  await prisma.userProfile.createMany({
    data: [
      profileData(ids.adminA, "Admin A"),
      profileData(ids.adminA2, "Admin A Two"),
      profileData(ids.memberA, "Member A"),
      profileData(ids.adminB, "Admin B"),
      profileData(ids.memberB, "Member B"),
      profileData(ids.adminC, "Admin C"),
      profileData(ids.approveUser, "Approve User"),
      profileData(ids.declineUser, "Decline User"),
      profileData(ids.raceUser, "Race User"),
      profileData(ids.addUser, "Add User"),
      profileData(ids.pendingAddUser, "Pending Add User"),
      profileData(ids.incompleteUser, "Incomplete User", false),
    ],
  });

  await prisma.organization.createMany({
    data: [
      { id: ids.organizationA, requestedByUserId: ids.adminA, name: `ACC02 Alpha ${runId}`, slug: `acc02-alpha-${runId}`, officialEmail: `alpha-${runId}@example.test`, officialPhone: "+94110000001", officialAddress: "Alpha address", status: OrganizationStatus.ACTIVE, activatedAt: new Date() },
      { id: ids.organizationB, requestedByUserId: ids.adminB, name: `ACC02 Beta ${runId}`, slug: `acc02-beta-${runId}`, officialEmail: `beta-${runId}@example.test`, officialPhone: "+94110000002", officialAddress: "Beta address", status: OrganizationStatus.ACTIVE, activatedAt: new Date() },
      { id: ids.organizationC, requestedByUserId: ids.adminC, name: `ACC02 Final Admin ${runId}`, slug: `acc02-final-${runId}`, officialEmail: `final-${runId}@example.test`, officialPhone: "+94110000003", officialAddress: "Final address", status: OrganizationStatus.ACTIVE, activatedAt: new Date() },
    ],
  });

  await prisma.organizationMembership.createMany({
    data: [
      { id: ids.adminAMembership, organizationId: ids.organizationA, userId: ids.adminA, role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE, source: MembershipSource.FIRST_ADMIN },
      { id: ids.adminA2Membership, organizationId: ids.organizationA, userId: ids.adminA2, role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE, source: MembershipSource.ADMIN_ADDED },
      { id: ids.memberAMembership, organizationId: ids.organizationA, userId: ids.memberA, role: MembershipRole.ORG_MEMBER, status: MembershipStatus.ACTIVE, source: MembershipSource.ADMIN_ADDED },
      { id: ids.adminAInBMembership, organizationId: ids.organizationB, userId: ids.adminA, role: MembershipRole.ORG_MEMBER, status: MembershipStatus.ACTIVE, source: MembershipSource.ADMIN_ADDED },
      { id: ids.adminAInCMembership, organizationId: ids.organizationC, userId: ids.adminA, role: MembershipRole.ORG_MEMBER, status: MembershipStatus.SUSPENDED, source: MembershipSource.ADMIN_ADDED },
      { id: ids.adminBMembership, organizationId: ids.organizationB, userId: ids.adminB, role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE, source: MembershipSource.FIRST_ADMIN },
      { id: ids.memberBMembership, organizationId: ids.organizationB, userId: ids.memberB, role: MembershipRole.ORG_MEMBER, status: MembershipStatus.ACTIVE, source: MembershipSource.ADMIN_ADDED },
      { id: ids.adminCMembership, organizationId: ids.organizationC, userId: ids.adminC, role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE, source: MembershipSource.FIRST_ADMIN },
    ],
  });

  await prisma.organizationMembershipRequest.createMany({
    data: [
      { id: ids.approveRequest, organizationId: ids.organizationA, requesterUserId: ids.approveUser, message: "Please verify my membership." },
      { id: ids.declineRequest, organizationId: ids.organizationA, requesterUserId: ids.declineUser, message: "I would like to join." },
      { id: ids.raceRequest, organizationId: ids.organizationA, requesterUserId: ids.raceUser },
      { id: ids.pendingAddRequest, organizationId: ids.organizationA, requesterUserId: ids.pendingAddUser },
      { id: ids.requestB, organizationId: ids.organizationB, requesterUserId: ids.memberA },
    ],
  });

  const app = createApp(authenticationDependencies, {
    authorizationDependencies,
    membershipAdministrationDependencies,
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  if (!server) throw new Error("The membership-administration test server did not start.");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
  }
  const organizationIds = [ids.organizationA, ids.organizationB, ids.organizationC];
  const userIds = [ids.adminA, ids.adminA2, ids.memberA, ids.adminB, ids.memberB, ids.adminC, ids.approveUser, ids.declineUser, ids.raceUser, ids.addUser, ids.pendingAddUser, ids.incompleteUser];
  await prisma.notification.deleteMany({ where: { OR: [{ organizationId: { in: organizationIds } }, { userId: { in: userIds } }] } });
  await prisma.auditLog.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationMembershipRequest.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
  await prisma.userProfile.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test("routes enforce authentication, profile completion, tenant isolation, and ORG_ADMIN ability", async () => {
  assert.equal((await fetch(`${baseUrl}/api/v1/organization-memberships/me/active`)).status, 401);
  assert.equal((await api("incomplete-token", "/organization-memberships/me/active")).status, 403);
  assert.equal((await api("member-a-token", `/organizations/${ids.organizationA}/members`)).status, 403);
  assert.equal((await api("admin-a-token", `/organizations/${ids.organizationB}/members`)).status, 403);
});

test("active workspace memberships are user-owned, active-only, and role-specific", async () => {
  const response = await api("admin-a-token", "/organization-memberships/me/active?limit=10");
  assert.equal(response.status, 200);
  const body = await response.json() as { data: ActiveOrganizationMembershipPageDto };
  assert.deepEqual(
    body.data.items.map(({ organization, role }) => [organization.id, role]).sort(),
    [[ids.organizationA, MembershipRole.ORG_ADMIN], [ids.organizationB, MembershipRole.ORG_MEMBER]].sort(),
  );
  assert.equal(body.data.items.some(({ organization }) => organization.id === ids.organizationC), false);
});

test("pending request listing is paginated and never exposes another tenant", async () => {
  const first = await api("admin-a-token", `/organizations/${ids.organizationA}/membership-requests?limit=2`);
  assert.equal(first.status, 200);
  const firstBody = await first.json() as { data: AdminMembershipRequestPageDto };
  assert.equal(firstBody.data.items.length, 2);
  assert.ok(firstBody.data.nextCursor);
  assert.equal(firstBody.data.items.some(({ id }) => id === ids.requestB), false);

  const second = await api("admin-a-token", `/organizations/${ids.organizationA}/membership-requests?limit=2&cursor=${encodeURIComponent(firstBody.data.nextCursor!)}`);
  assert.equal(second.status, 200);
  const secondBody = await second.json() as { data: AdminMembershipRequestPageDto };
  assert.equal(new Set([...firstBody.data.items, ...secondBody.data.items].map(({ id }) => id)).size, 4);
  assert.equal((await api("admin-a-token", `/organizations/${ids.organizationA}/membership-requests?cursor=invalid`)).status, 400);
  assert.equal((await api("admin-a-token", `/organizations/${ids.organizationA}/membership-requests/${ids.requestB}/approve`, { method: "PATCH" })).status, 404);
});

test("approval atomically reviews, creates one member, audits, and notifies", async () => {
  const response = await api("admin-a-token", `/organizations/${ids.organizationA}/membership-requests/${ids.approveRequest}/approve`, { method: "PATCH" });
  assert.equal(response.status, 200);
  const body = await response.json() as { data: AdminMembershipRequestDto };
  assert.equal(body.data.status, MembershipRequestStatus.APPROVED);

  const membership = await prisma.organizationMembership.findUniqueOrThrow({
    where: { organizationId_userId: { organizationId: ids.organizationA, userId: ids.approveUser } },
  });
  assert.equal(membership.role, MembershipRole.ORG_MEMBER);
  assert.equal(membership.source, MembershipSource.REQUEST_APPROVED);
  assert.equal(membership.sourceRequestId, ids.approveRequest);
  assert.equal(membership.addedOrApprovedByMembershipId, ids.adminAMembership);
  assert.equal(await prisma.auditLog.count({ where: { action: "ORGANIZATION_MEMBERSHIP_REQUEST_APPROVED", entityId: ids.approveRequest } }), 1);
  assert.equal(await prisma.notification.count({ where: { userId: ids.approveUser, data: { path: ["membershipRequestId"], equals: ids.approveRequest } } }), 1);
  assert.equal((await api("admin-a2-token", `/organizations/${ids.organizationA}/membership-requests/${ids.approveRequest}/approve`, { method: "PATCH" })).status, 409);
});

test("decline requires and records a useful reason without creating membership", async () => {
  const invalid = await api("admin-a-token", `/organizations/${ids.organizationA}/membership-requests/${ids.declineRequest}/decline`, {
    method: "PATCH",
    body: JSON.stringify({ reason: "no" }),
  });
  assert.equal(invalid.status, 400);

  const response = await api("admin-a-token", `/organizations/${ids.organizationA}/membership-requests/${ids.declineRequest}/decline`, {
    method: "PATCH",
    body: JSON.stringify({ reason: "Membership could not be verified." }),
  });
  assert.equal(response.status, 200);
  const body = await response.json() as { data: AdminMembershipRequestDto };
  assert.equal(body.data.status, MembershipRequestStatus.DECLINED);
  assert.equal(body.data.reviewNotes, "Membership could not be verified.");
  assert.equal(await prisma.organizationMembership.count({ where: { organizationId: ids.organizationA, userId: ids.declineUser } }), 0);
  assert.equal(await prisma.auditLog.count({ where: { action: "ORGANIZATION_MEMBERSHIP_REQUEST_DECLINED", entityId: ids.declineRequest } }), 1);
});

test("concurrent request review has one winner and one stable conflict", async () => {
  const responses = await Promise.all([
    api("admin-a-token", `/organizations/${ids.organizationA}/membership-requests/${ids.raceRequest}/approve`, { method: "PATCH" }),
    api("admin-a2-token", `/organizations/${ids.organizationA}/membership-requests/${ids.raceRequest}/decline`, { method: "PATCH", body: JSON.stringify({ reason: "Concurrent review decision." }) }),
  ]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);
  const request = await prisma.organizationMembershipRequest.findUniqueOrThrow({ where: { id: ids.raceRequest } });
  assert.notEqual(request.status, MembershipRequestStatus.PENDING);
  assert.equal(await prisma.auditLog.count({ where: { entityId: ids.raceRequest, action: { in: ["ORGANIZATION_MEMBERSHIP_REQUEST_APPROVED", "ORGANIZATION_MEMBERSHIP_REQUEST_DECLINED"] } } }), 1);
  assert.equal(await prisma.notification.count({ where: { userId: ids.raceUser, data: { path: ["membershipRequestId"], equals: ids.raceRequest } } }), 1);
});

test("admins add eligible existing users but cannot bypass pending review or duplicate membership", async () => {
  const addUser = await prisma.userProfile.findUniqueOrThrow({ where: { id: ids.addUser }, select: { email: true } });
  const response = await api("admin-a-token", `/organizations/${ids.organizationA}/members`, {
    method: "POST",
    body: JSON.stringify({ email: addUser.email }),
  });
  assert.equal(response.status, 201);
  const body = await response.json() as { data: OrganizationMemberDto };
  assert.equal(body.data.role, MembershipRole.ORG_MEMBER);
  assert.equal(body.data.source, MembershipSource.ADMIN_ADDED);
  assert.equal((await api("admin-a-token", `/organizations/${ids.organizationA}/members`, { method: "POST", body: JSON.stringify({ email: addUser.email }) })).status, 409);

  const pendingUser = await prisma.userProfile.findUniqueOrThrow({ where: { id: ids.pendingAddUser }, select: { email: true } });
  assert.equal((await api("admin-a-token", `/organizations/${ids.organizationA}/members`, { method: "POST", body: JSON.stringify({ email: pendingUser.email }) })).status, 409);
  const incomplete = await prisma.userProfile.findUniqueOrThrow({ where: { id: ids.incompleteUser }, select: { email: true } });
  assert.equal((await api("admin-a-token", `/organizations/${ids.organizationA}/members`, { method: "POST", body: JSON.stringify({ email: incomplete.email }) })).status, 409);
});

test("role and status management is tenant-bound and preserves final active admins", async () => {
  const members = await api("admin-a-token", `/organizations/${ids.organizationA}/members?limit=20`);
  assert.equal(members.status, 200);
  const memberBody = await members.json() as { data: OrganizationMemberPageDto };
  assert.equal(memberBody.data.items.some(({ id }) => id === ids.memberBMembership), false);
  assert.equal((await api("member-a-token", `/organizations/${ids.organizationA}/members/${ids.memberAMembership}/role`, { method: "PATCH", body: JSON.stringify({ role: MembershipRole.ORG_ADMIN }) })).status, 403);

  const promoted = await api("admin-a-token", `/organizations/${ids.organizationA}/members/${ids.memberAMembership}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role: MembershipRole.ORG_ADMIN }),
  });
  assert.equal(promoted.status, 200);
  assert.equal((await api("admin-a-token", `/organizations/${ids.organizationA}/members/${ids.memberBMembership}/role`, { method: "PATCH", body: JSON.stringify({ role: MembershipRole.ORG_ADMIN }) })).status, 404);

  assert.equal((await api("admin-a-token", `/organizations/${ids.organizationA}/members/${ids.memberAMembership}/role`, { method: "PATCH", body: JSON.stringify({ role: MembershipRole.ORG_MEMBER }) })).status, 200);
  assert.equal((await api("admin-a-token", `/organizations/${ids.organizationA}/members/${ids.memberAMembership}/status`, { method: "PATCH", body: JSON.stringify({ status: MembershipStatus.SUSPENDED }) })).status, 200);
  assert.equal((await api("member-a-token", `/organizations/${ids.organizationA}/members`)).status, 403);
  assert.equal((await api("admin-a-token", `/organizations/${ids.organizationA}/members/${ids.memberAMembership}/status`, { method: "PATCH", body: JSON.stringify({ status: MembershipStatus.ACTIVE }) })).status, 200);
  assert.equal((await api("admin-a-token", `/organizations/${ids.organizationA}/members/${ids.memberAMembership}/status`, { method: "PATCH", body: JSON.stringify({ status: MembershipStatus.REMOVED }) })).status, 200);
  assert.equal((await api("admin-a-token", `/organizations/${ids.organizationA}/members/${ids.memberAMembership}/status`, { method: "PATCH", body: JSON.stringify({ status: MembershipStatus.SUSPENDED }) })).status, 409);

  assert.equal((await api("admin-c-token", `/organizations/${ids.organizationC}/members/${ids.adminCMembership}/role`, { method: "PATCH", body: JSON.stringify({ role: MembershipRole.ORG_MEMBER }) })).status, 409);
  assert.equal((await api("admin-c-token", `/organizations/${ids.organizationC}/members/${ids.adminCMembership}/status`, { method: "PATCH", body: JSON.stringify({ status: MembershipStatus.SUSPENDED }) })).status, 409);
  assert.equal((await api("admin-c-token", `/organizations/${ids.organizationC}/members/${ids.adminCMembership}/status`, { method: "PATCH", body: JSON.stringify({ status: MembershipStatus.REMOVED }) })).status, 409);
  assert.equal(await prisma.organizationMembership.count({ where: { organizationId: ids.organizationC, role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE } }), 1);
});

test("concurrent admin demotions never leave an organization without an active admin", async () => {
  const responses = await Promise.all([
    api("admin-a-token", `/organizations/${ids.organizationA}/members/${ids.adminA2Membership}/role`, { method: "PATCH", body: JSON.stringify({ role: MembershipRole.ORG_MEMBER }) }),
    api("admin-a2-token", `/organizations/${ids.organizationA}/members/${ids.adminAMembership}/role`, { method: "PATCH", body: JSON.stringify({ role: MembershipRole.ORG_MEMBER }) }),
  ]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);
  assert.equal(await prisma.organizationMembership.count({ where: { organizationId: ids.organizationA, role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE } }), 1);
});
