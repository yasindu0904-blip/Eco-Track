import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

import { createApp } from "../../app.js";
import { prisma } from "../../database/prisma.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import { cleanupEventDependencies } from "./cleanupEvent.dependencies.js";

const organizationAId = randomUUID();
const organizationBId = randomUUID();
const serviceAreaId = randomUUID();
const categoryId = randomUUID();
const visibleIncidentId = randomUUID();
const invisibleIncidentId = randomUUID();

const identities = {
  adminA: { token: "evt02-admin-a", id: randomUUID(), authUserId: randomUUID(), membershipId: randomUUID() },
  memberA: { token: "evt02-member-a", id: randomUUID(), authUserId: randomUUID(), membershipId: randomUUID() },
  adminB: { token: "evt02-admin-b", id: randomUUID(), authUserId: randomUUID(), membershipId: randomUUID() },
  reporter: { token: "evt02-reporter", id: randomUUID(), authUserId: randomUUID(), membershipId: randomUUID() },
} as const;

function profileFor(identity: (typeof identities)[keyof typeof identities]) {
  return {
    id: identity.id,
    email: `${identity.token}-${identity.id}@example.com`,
    fullName: identity.token,
    phoneNumber: "+94770000001",
    profileCompletedAt: new Date(),
    platformRole: "USER" as const,
    accountStatus: "ACTIVE" as const,
  };
}

const identityByToken = new Map<string, (typeof identities)[keyof typeof identities]>(
  Object.values(identities).map((identity) => [identity.token, identity]),
);

const authenticationDependencies: AuthenticationDependencies = {
  async verifyAccessToken(token) {
    const identity = identityByToken.get(token);
    return identity
      ? { authUserId: identity.authUserId, email: `${identity.token}-${identity.id}@example.com` }
      : null;
  },
  async provisionOrSynchronizeProfile(identity) {
    const matched = Object.values(identities).find(
      (candidate) => candidate.authUserId === identity.authUserId,
    );
    if (!matched) throw new Error("Unknown EVT-02 test identity.");
    return profileFor(matched);
  },
};

let server: Server | undefined;
let baseUrl = "";

function request(token: string, path: string, options: RequestInit = {}) {
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

function draftInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Community canal cleanup",
    description: "Remove plastic waste from the canal and surrounding path.",
    eventLatitude: 6.95,
    eventLongitude: 79.9,
    ...overrides,
  };
}

async function createDirectDraft(title = "Direct cleanup draft"): Promise<string> {
  const response = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts`,
    { method: "POST", body: JSON.stringify(draftInput({ title })) },
  );
  assert.equal(response.status, 201);
  return (await response.json()).data.id as string;
}

before(async () => {
  await prisma.userProfile.createMany({
    data: Object.values(identities).map((identity) => ({
      id: identity.id,
      authUserId: identity.authUserId,
      email: `${identity.token}-${identity.id}@example.com`,
      fullName: identity.token,
      phoneNumber: "+94770000001",
      profileCompletedAt: new Date(),
    })),
  });

  await prisma.organization.create({
    data: {
      id: organizationAId,
      requestedByUserId: identities.adminA.id,
      name: `EVT-02 Organization A ${organizationAId}`,
      slug: `evt02-a-${organizationAId}`,
      officialEmail: `${identities.adminA.token}-${identities.adminA.id}@example.com`,
      officialPhone: "+94770000001",
      officialAddress: "Colombo, Sri Lanka",
      status: "ACTIVE",
    },
  });
  await prisma.organization.create({
    data: {
      id: organizationBId,
      requestedByUserId: identities.adminB.id,
      name: `EVT-02 Organization B ${organizationBId}`,
      slug: `evt02-b-${organizationBId}`,
      officialEmail: `${identities.adminB.token}-${identities.adminB.id}@example.com`,
      officialPhone: "+94770000002",
      officialAddress: "Kandy, Sri Lanka",
      status: "ACTIVE",
    },
  });
  await prisma.organizationMembership.createMany({
    data: [
      { id: identities.adminA.membershipId, organizationId: organizationAId, userId: identities.adminA.id, role: "ORG_ADMIN", status: "ACTIVE", source: "FIRST_ADMIN" },
      { id: identities.memberA.membershipId, organizationId: organizationAId, userId: identities.memberA.id, role: "ORG_MEMBER", status: "ACTIVE", source: "ADMIN_ADDED" },
      { id: identities.adminB.membershipId, organizationId: organizationBId, userId: identities.adminB.id, role: "ORG_ADMIN", status: "ACTIVE", source: "FIRST_ADMIN" },
    ],
  });

  await prisma.incidentCategory.create({
    data: { id: categoryId, name: `EVT-02 category ${categoryId}`, isActive: true },
  });
  const now = Date.now();
  await prisma.incident.createMany({
    data: [
      {
        id: visibleIncidentId,
        reporterUserId: identities.reporter.id,
        submissionId: randomUUID(),
        categoryId,
        title: "Visible EVT-02 incident",
        description: "An incident covered by Organization A's active boundary.",
        severity: "MEDIUM",
        latitude: 6.97,
        longitude: 79.92,
        highlightUntil: new Date(now + 86_400_000),
        archiveAfter: new Date(now + 604_800_000),
      },
      {
        id: invisibleIncidentId,
        reporterUserId: identities.reporter.id,
        submissionId: randomUUID(),
        categoryId,
        title: "Invisible EVT-02 incident",
        description: "An incident outside Organization A's service area.",
        severity: "LOW",
        latitude: 8.0,
        longitude: 80.5,
        highlightUntil: new Date(now + 86_400_000),
        archiveAfter: new Date(now + 604_800_000),
      },
    ],
  });
  await prisma.$executeRaw`
    INSERT INTO "organization_service_areas" (
      "id", "organization_id", "area_name", "boundary", "status",
      "created_at", "updated_at"
    ) VALUES (
      ${serviceAreaId}::uuid,
      ${organizationAId}::uuid,
      'EVT-02 active service area',
      extensions.ST_GeogFromText(
        'MULTIPOLYGON(((79.85 6.90, 80.00 6.90, 80.00 7.05, 79.85 7.05, 79.85 6.90)))'
      ),
      'ACTIVE'::"ServiceAreaStatus",
      NOW(),
      NOW()
    )
  `;

  const app = createApp(authenticationDependencies, { cleanupEventDependencies });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}/api/v1`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => error ? reject(error) : resolve());
    });
  }
  await prisma.cleanupEvent.deleteMany({
    where: { organizationId: { in: [organizationAId, organizationBId] } },
  });
  await prisma.organizationServiceArea.deleteMany({ where: { id: serviceAreaId } });
  await prisma.incident.deleteMany({ where: { id: { in: [visibleIncidentId, invisibleIncidentId] } } });
  await prisma.incidentCategory.deleteMany({ where: { id: categoryId } });
  await prisma.cleanupWorkflowStatus.deleteMany({
    where: { organizationId: { in: [organizationAId, organizationBId] } },
  });
  await prisma.organizationMembership.deleteMany({
    where: { organizationId: { in: [organizationAId, organizationBId] } },
  });
  await prisma.organization.deleteMany({ where: { id: { in: [organizationAId, organizationBId] } } });
  await prisma.userProfile.deleteMany({
    where: { id: { in: Object.values(identities).map((identity) => identity.id) } },
  });
});

test("ORG_ADMIN can manage organization drafts while ORG_MEMBER and other tenants cannot", async () => {
  const draftId = await createDirectDraft();

  const memberCreate = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/drafts`,
    { method: "POST", body: JSON.stringify(draftInput()) },
  );
  assert.equal(memberCreate.status, 403);

  const crossTenantRead = await request(
    identities.adminB.token,
    `/organizations/${organizationAId}/events/drafts/${draftId}`,
  );
  assert.equal(crossTenantRead.status, 403);

  const updated = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts/${draftId}`,
    { method: "PATCH", body: JSON.stringify({ title: "Updated direct cleanup draft" }) },
  );
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).data.title, "Updated direct cleanup draft");

  const listed = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts?limit=1`,
  );
  assert.equal(listed.status, 200);
  const page = await listed.json();
  assert.ok(Array.isArray(page.data.items));
  assert.ok(Array.isArray(page.data.items[0].sessions));
  assert.ok(Array.isArray(page.data.items[0].coordinators));
});

test("linked drafts require real organization visibility and DRAFT never claims the incident", async () => {
  const rejected = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts`,
    { method: "POST", body: JSON.stringify(draftInput({ incidentId: invisibleIncidentId })) },
  );
  assert.equal(rejected.status, 404);

  const accepted = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts`,
    { method: "POST", body: JSON.stringify(draftInput({ incidentId: visibleIncidentId })) },
  );
  assert.equal(accepted.status, 201);
  const linkedDraftId = (await accepted.json()).data.id as string;

  const incident = await prisma.incident.findUniqueOrThrow({
    where: { id: visibleIncidentId },
    select: { status: true },
  });
  assert.equal(incident.status, "ACTIVE");

  const directDraftId = await createDirectDraft("Visibility update draft");
  const bypass = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts/${directDraftId}`,
    { method: "PATCH", body: JSON.stringify({ incidentId: invisibleIncidentId }) },
  );
  assert.equal(bypass.status, 404);
  const unchanged = await prisma.cleanupEvent.findUniqueOrThrow({
    where: { id: directDraftId },
    select: { incidentId: true },
  });
  assert.equal(unchanged.incidentId, null);

  const visibleUpdate = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts/${directDraftId}`,
    { method: "PATCH", body: JSON.stringify({ incidentId: visibleIncidentId }) },
  );
  assert.equal(visibleUpdate.status, 200);
  assert.equal((await visibleUpdate.json()).data.incidentId, visibleIncidentId);
  assert.notEqual(linkedDraftId, directDraftId);
});

test("sessions are tenant-bound, validated, unique, editable, and DRAFT-only", async () => {
  const draftId = await createDirectDraft("Session management draft");
  const otherDraftId = await createDirectDraft("Other session draft");
  const input = {
    sessionDate: "2027-09-01",
    startTime: "09:00:00",
    endTime: "11:00:00",
    capacity: 10,
    notes: "Bring gloves",
  };

  const created = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${draftId}/sessions`,
    { method: "POST", body: JSON.stringify(input) },
  );
  assert.equal(created.status, 201);
  const sessionId = (await created.json()).data.id as string;

  const duplicate = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${draftId}/sessions`,
    { method: "POST", body: JSON.stringify({ ...input, endTime: "12:00:00" }) },
  );
  assert.equal(duplicate.status, 409);

  const invalid = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${draftId}/sessions`,
    { method: "POST", body: JSON.stringify({ ...input, sessionDate: "2027-02-31" }) },
  );
  assert.equal(invalid.status, 400);

  const crossEventUpdate = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${otherDraftId}/sessions/${sessionId}`,
    { method: "PATCH", body: JSON.stringify({ ...input, startTime: "10:00:00", endTime: "12:00:00" }) },
  );
  assert.equal(crossEventUpdate.status, 404);

  const updated = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${draftId}/sessions/${sessionId}`,
    { method: "PATCH", body: JSON.stringify({ ...input, startTime: "10:00:00", endTime: "12:00:00" }) },
  );
  assert.equal(updated.status, 200);

  const publishedStatus = await prisma.cleanupWorkflowStatus.findFirstOrThrow({
    where: { organizationId: organizationAId, mappedLifecycleStatus: "PUBLISHED", isActive: true },
  });
  await prisma.cleanupEvent.update({
    where: { id: otherDraftId },
    data: {
      lifecycleStatus: "PUBLISHED",
      currentWorkflowStatusId: publishedStatus.id,
      publishedAt: new Date(),
    },
  });
  const nonDraftMutation = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${otherDraftId}/sessions`,
    { method: "POST", body: JSON.stringify({ ...input, sessionDate: "2027-09-02" }) },
  );
  assert.equal(nonDraftMutation.status, 404);

  const removed = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${draftId}/sessions/${sessionId}`,
    { method: "DELETE" },
  );
  assert.equal(removed.status, 204);
});

test("coordinators must be active same-organization members and can be removed and reassigned", async () => {
  const draftId = await createDirectDraft("Coordinator management draft");
  const route = `/organizations/${organizationAId}/events/${draftId}/coordinators`;

  const memberSelfAssign = await request(
    identities.memberA.token,
    route,
    { method: "POST", body: JSON.stringify({ membershipId: identities.memberA.membershipId }) },
  );
  assert.equal(memberSelfAssign.status, 403);

  const crossTenant = await request(
    identities.adminA.token,
    route,
    { method: "POST", body: JSON.stringify({ membershipId: identities.adminB.membershipId }) },
  );
  assert.equal(crossTenant.status, 400);

  const assigned = await request(
    identities.adminA.token,
    route,
    { method: "POST", body: JSON.stringify({ membershipId: identities.memberA.membershipId }) },
  );
  assert.equal(assigned.status, 201);

  const removed = await request(
    identities.adminA.token,
    route,
    { method: "DELETE", body: JSON.stringify({ membershipId: identities.memberA.membershipId }) },
  );
  assert.equal(removed.status, 204);

  const removedAgain = await request(
    identities.adminA.token,
    route,
    { method: "DELETE", body: JSON.stringify({ membershipId: identities.memberA.membershipId }) },
  );
  assert.equal(removedAgain.status, 404);

  const reassigned = await request(
    identities.adminA.token,
    route,
    { method: "POST", body: JSON.stringify({ membershipId: identities.memberA.membershipId }) },
  );
  assert.equal(reassigned.status, 201);
  assert.equal(
    await prisma.eventCoordinator.count({
      where: { cleanupEventId: draftId, membershipId: identities.memberA.membershipId },
    }),
    1,
  );
});

test("discard removes only a tenant-owned private DRAFT", async () => {
  const draftId = await createDirectDraft("Discardable private draft");
  const crossTenantDiscard = await request(
    identities.adminB.token,
    `/organizations/${organizationAId}/events/drafts/${draftId}`,
    { method: "DELETE" },
  );
  assert.equal(crossTenantDiscard.status, 403);

  const discarded = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts/${draftId}`,
    { method: "DELETE" },
  );
  assert.equal(discarded.status, 204);
  assert.equal(await prisma.cleanupEvent.count({ where: { id: draftId } }), 0);
});
