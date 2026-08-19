import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

import express from "express";

import { prisma } from "../../database/prisma.js";
import { createApp } from "../../app.js";
import { cleanupEventDependencies } from "./cleanupEvent.dependencies.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";

const userId = randomUUID();
const userAuthId = randomUUID();
const orgId = randomUUID();
const membershipId = randomUUID();
const otherMembershipId = randomUUID();
const otherUserId = randomUUID();
const otherAuthUserId = randomUUID();
const orgBId = randomUUID();
const orgBMembershipId = randomUUID();
const token = `cleanup-${userId}`;

const profile = {
  id: userId,
  email: `cleanup-${userId}@example.com`,
  fullName: "Cleanup Test",
  phoneNumber: "+94770000001",
  profileCompletedAt: new Date(),
  platformRole: "USER" as const,
  accountStatus: "ACTIVE" as const,
};

const authenticationDependencies: AuthenticationDependencies = {
  async verifyAccessToken(t) {
    if (t === token) return { authUserId: userAuthId, email: profile.email };
    return null;
  },
  async provisionOrSynchronizeProfile(identity) {
    return profile as any;
  },
};

let server: Server | undefined;
let baseUrl = "";

function request(path: string, options: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      "content-type": "application/json",
      ...options.headers,
    },
  });
}

before(async () => {
  await prisma.userProfile.create({ data: { id: userId, authUserId: userAuthId, email: profile.email, fullName: profile.fullName, phoneNumber: profile.phoneNumber, profileCompletedAt: profile.profileCompletedAt } });
  await prisma.userProfile.create({ data: { id: otherUserId, authUserId: otherAuthUserId, email: `coordinator-${otherUserId}@example.com`, fullName: "Coordinator Test", phoneNumber: "+94770000002", profileCompletedAt: new Date() } });
  await prisma.organization.create({ data: { id: orgId, requestedByUserId: userId, name: "CleanupOrg", slug: `cleanup-${orgId}`, officialEmail: `a@b.com`, officialPhone: "+1", officialAddress: "addr", status: "ACTIVE" } });
  await prisma.organization.create({ data: { id: orgBId, requestedByUserId: otherUserId, name: "Other Cleanup Org", slug: `cleanup-${orgBId}`, officialEmail: `other-${orgBId}@example.com`, officialPhone: "+2", officialAddress: "other addr", status: "ACTIVE" } });
  await prisma.organizationMembership.createMany({ data: [ { id: membershipId, organizationId: orgId, userId, role: "ORG_ADMIN", status: "ACTIVE", source: "FIRST_ADMIN" }, { id: otherMembershipId, organizationId: orgId, userId: otherUserId, role: "ORG_MEMBER", status: "ACTIVE", source: "ADMIN_ADDED" } ] });
  await prisma.organizationMembership.create({ data: { id: orgBMembershipId, organizationId: orgBId, userId: otherUserId, role: "ORG_ADMIN", status: "ACTIVE", source: "FIRST_ADMIN" } });

  const app = createApp(authenticationDependencies, { cleanupEventDependencies });
  server = app.listen(0);
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
});

after(async () => {
  if (server) await new Promise((r) => server!.close(r));
  await prisma.eventCoordinator.deleteMany({ where: { cleanupEvent: { organizationId: orgId } } }).catch(() => null);
  await prisma.cleanupEvent.deleteMany({ where: { organizationId: orgId } }).catch(() => null);
  await prisma.cleanupWorkflowStatus.deleteMany({ where: { organizationId: orgId } }).catch(() => null);
  await prisma.organizationMembership.deleteMany({ where: { organizationId: { in: [orgId, orgBId] } } }).catch(() => null);
  await prisma.organization.deleteMany({ where: { id: { in: [orgId, orgBId] } } }).catch(() => null);
  await prisma.userProfile.deleteMany({ where: { id: { in: [userId, otherUserId] } } }).catch(() => null);
});

test("create draft, list drafts, create session, assign coordinator", async () => {
  const createRes = await request(`/organizations/${orgId}/events/drafts`, { method: "POST", body: JSON.stringify({ title: "Test Draft", description: "A complete cleanup event description", eventLatitude: 6.9, eventLongitude: 79.8 }) });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  const draftId = created.data.id;

  const listRes = await request(`/organizations/${orgId}/events/drafts`);
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert(Array.isArray(listBody.data) && listBody.data.length >= 1);

  const sessionRes = await request(`/organizations/${orgId}/events/${draftId}/sessions`, { method: "POST", body: JSON.stringify({ sessionDate: "2026-09-01", startTime: "09:00:00", endTime: "11:00:00", capacity: 10 }) });
  assert.equal(sessionRes.status, 201);

  const invalidSession = await request(`/organizations/${orgId}/events/${draftId}/sessions`, { method: "POST", body: JSON.stringify({ sessionDate: "2026-09-02", startTime: "11:00:00", endTime: "09:00:00", capacity: 0 }) });
  assert.equal(invalidSession.status, 400);
  const duplicateSession = await request(`/organizations/${orgId}/events/${draftId}/sessions`, { method: "POST", body: JSON.stringify({ sessionDate: "2026-09-01", startTime: "09:00:00", endTime: "12:00:00", capacity: 5 }) });
  assert.equal(duplicateSession.status, 409);

  const assignRes = await request(`/organizations/${orgId}/events/${draftId}/coordinators`, { method: "POST", body: JSON.stringify({ membershipId: otherMembershipId }) });
  // ORG_ADMIN assigns, should succeed
  assert.equal(assignRes.status, 201);

  const crossTenantCoordinator = await request(`/organizations/${orgId}/events/${draftId}/coordinators`, { method: "POST", body: JSON.stringify({ membershipId: orgBMembershipId }) });
  assert.equal(crossTenantCoordinator.status, 400);

  const crossTenantDraft = await request(`/organizations/${orgBId}/events/drafts`, { method: "POST", body: JSON.stringify({ title: "Forbidden draft", description: "This organization is not available", eventLatitude: 6.9, eventLongitude: 79.8 }) });
  assert.equal(crossTenantDraft.status, 403);
});
