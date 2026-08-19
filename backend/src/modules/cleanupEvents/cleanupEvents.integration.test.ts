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
const claimIncidentId = randomUUID();

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

async function makeDraftPublishable(
  token: string,
  organizationId: string,
  eventId: string,
  coordinatorMembershipId: string,
): Promise<void> {
  const update = await request(
    token,
    `/organizations/${organizationId}/events/drafts/${eventId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        publicInstructions: "Wear closed shoes and bring drinking water.",
        eventAddress: "Community meeting point, Colombo",
      }),
    },
  );
  assert.equal(update.status, 200);
  const session = await request(
    token,
    `/organizations/${organizationId}/events/${eventId}/sessions`,
    {
      method: "POST",
      body: JSON.stringify({
        sessionDate: "2099-09-01",
        startTime: "09:00:00",
        endTime: "12:00:00",
        capacity: 30,
        notes: "Internal setup note that must not become public.",
      }),
    },
  );
  assert.equal(session.status, 201);
  const coordinator = await request(
    token,
    `/organizations/${organizationId}/events/${eventId}/coordinators`,
    { method: "POST", body: JSON.stringify({ membershipId: coordinatorMembershipId }) },
  );
  assert.equal(coordinator.status, 201);
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
      {
        id: claimIncidentId,
        reporterUserId: identities.reporter.id,
        submissionId: randomUUID(),
        categoryId,
        title: "Concurrent publication incident",
        description: "A shared incident used to verify database-backed event claiming.",
        severity: "HIGH",
        latitude: 6.96,
        longitude: 79.92,
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
  await prisma.auditLog.deleteMany({
    where: { organizationId: { in: [organizationAId, organizationBId] } },
  });
  await prisma.organizationServiceArea.deleteMany({ where: { id: serviceAreaId } });
  await prisma.incident.deleteMany({ where: { id: { in: [visibleIncidentId, invisibleIncidentId, claimIncidentId] } } });
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

test("publish readiness is server-derived and only ORG_ADMIN can publish", async () => {
  const eventId = await createDirectDraft("Readiness protected event");
  const initial = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/publish-readiness`,
  );
  assert.equal(initial.status, 200);
  const initialBody = await initial.json();
  assert.equal(initialBody.data.ready, false);
  assert.ok(initialBody.data.checks.some((item: { ready: boolean }) => !item.ready));

  const memberPublish = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/${eventId}/publish`,
    { method: "POST" },
  );
  assert.equal(memberPublish.status, 403);

  const crossTenantPublish = await request(
    identities.adminB.token,
    `/organizations/${organizationAId}/events/${eventId}/publish`,
    { method: "POST" },
  );
  assert.equal(crossTenantPublish.status, 403);

  const notReady = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/publish`,
    { method: "POST" },
  );
  assert.equal(notReady.status, 409);
  assert.equal((await notReady.json()).error.code, "CLEANUP_EVENT_NOT_READY");
  assert.equal(
    await prisma.cleanupEvent.findUniqueOrThrow({ where: { id: eventId }, select: { lifecycleStatus: true } }).then((event) => event.lifecycleStatus),
    "DRAFT",
  );
});

test("a direct event publishes atomically and exposes only public-safe detail", async () => {
  const eventId = await createDirectDraft("Public direct cleanup event");
  await makeDraftPublishable(
    identities.adminA.token,
    organizationAId,
    eventId,
    identities.memberA.membershipId,
  );

  const readiness = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/publish-readiness`,
  );
  assert.equal(readiness.status, 200);
  assert.equal((await readiness.json()).data.ready, true);

  const published = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/publish`,
    { method: "POST" },
  );
  assert.equal(published.status, 200);
  const publishedBody = await published.json();
  assert.equal(publishedBody.data.event.lifecycleStatus, "PUBLISHED");
  assert.equal(publishedBody.data.incidentUpdated, false);

  const replay = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/publish`,
    { method: "POST" },
  );
  assert.equal(replay.status, 200);
  assert.equal(await prisma.eventStatusHistory.count({ where: { cleanupEventId: eventId } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { action: "CLEANUP_EVENT_PUBLISHED", entityId: eventId } }), 1);

  const detail = await request(identities.reporter.token, `/events/${eventId}`);
  assert.equal(detail.status, 200);
  const detailBody = (await detail.json()).data as Record<string, unknown>;
  assert.equal("coordinators" in detailBody, false);
  assert.equal("createdByMembershipId" in detailBody, false);
  assert.equal(JSON.stringify(detailBody).includes("officialPhone"), false);
  assert.equal(JSON.stringify(detailBody).includes("notes"), false);

  const listed = await request(identities.reporter.token, "/events?limit=50");
  assert.equal(listed.status, 200);
  assert.ok((await listed.json()).data.items.some((item: { id: string }) => item.id === eventId));

  const map = await request(
    identities.reporter.token,
    "/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=50",
  );
  assert.equal(map.status, 200);
  assert.ok((await map.json()).data.features.some(
    (feature: { properties: { id: string; kind: string } }) =>
      feature.properties.id === eventId && feature.properties.kind === "CLEANUP_EVENT",
  ));
});

test("linked publication requires VALID review and updates incident, histories, audit, and notification", async () => {
  const create = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts`,
    { method: "POST", body: JSON.stringify(draftInput({ incidentId: visibleIncidentId, title: "Validated incident cleanup" })) },
  );
  assert.equal(create.status, 201);
  const eventId = (await create.json()).data.id as string;
  await makeDraftPublishable(
    identities.adminA.token,
    organizationAId,
    eventId,
    identities.memberA.membershipId,
  );

  const blocked = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/publish`,
    { method: "POST" },
  );
  assert.equal(blocked.status, 409);

  await prisma.incidentReview.create({
    data: {
      incidentId: visibleIncidentId,
      organizationId: organizationAId,
      status: "VALID",
      reviewedByMembershipId: identities.adminA.membershipId,
      reviewedAt: new Date(),
    },
  });
  const published = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/publish`,
    { method: "POST" },
  );
  assert.equal(published.status, 200);
  assert.equal((await published.json()).data.incidentUpdated, true);

  const incident = await prisma.incident.findUniqueOrThrow({ where: { id: visibleIncidentId } });
  assert.equal(incident.status, "CLEANUP_ORGANIZED");
  assert.equal(
    await prisma.incidentStatusHistory.count({
      where: { incidentId: visibleIncidentId, relatedCleanupEventId: eventId, toStatus: "CLEANUP_ORGANIZED" },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: { userId: identities.reporter.id, type: "EVENT_PUBLISHED", data: { path: ["eventId"], equals: eventId } },
    }),
    1,
  );
});

test("concurrent linked publication produces one winner and one stable 409", async () => {
  await prisma.incidentReview.createMany({
    data: [
      {
        incidentId: claimIncidentId,
        organizationId: organizationAId,
        status: "VALID",
        reviewedByMembershipId: identities.adminA.membershipId,
        reviewedAt: new Date(),
      },
      {
        incidentId: claimIncidentId,
        organizationId: organizationBId,
        status: "VALID",
        reviewedByMembershipId: identities.adminB.membershipId,
        reviewedAt: new Date(),
      },
    ],
  });
  const [draftA, draftB] = await Promise.all([
    request(
      identities.adminA.token,
      `/organizations/${organizationAId}/events/drafts`,
      { method: "POST", body: JSON.stringify(draftInput({ incidentId: claimIncidentId, title: "Organization A claim" })) },
    ),
    request(
      identities.adminB.token,
      `/organizations/${organizationBId}/events/drafts`,
      { method: "POST", body: JSON.stringify(draftInput({ incidentId: claimIncidentId, title: "Organization B claim" })) },
    ),
  ]);
  assert.equal(draftA.status, 201);
  assert.equal(draftB.status, 201);
  const eventA = (await draftA.json()).data.id as string;
  const eventB = (await draftB.json()).data.id as string;
  await Promise.all([
    makeDraftPublishable(identities.adminA.token, organizationAId, eventA, identities.adminA.membershipId),
    makeDraftPublishable(identities.adminB.token, organizationBId, eventB, identities.adminB.membershipId),
  ]);

  const responses = await Promise.all([
    request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventA}/publish`, { method: "POST" }),
    request(identities.adminB.token, `/organizations/${organizationBId}/events/${eventB}/publish`, { method: "POST" }),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const conflict = responses.find((response) => response.status === 409)!;
  const conflictBody = await conflict.json();
  assert.equal(conflictBody.error.code, "INCIDENT_ALREADY_CLAIMED");
  assert.ok(conflictBody.error.details.eventId);
  const winningEventId = conflictBody.error.details.eventId as string;
  const losingEventId = winningEventId === eventA ? eventB : eventA;
  assert.equal(
    await prisma.cleanupEvent.count({
      where: { incidentId: claimIncidentId, lifecycleStatus: "PUBLISHED" },
    }),
    1,
  );
  assert.equal(
    await prisma.cleanupEvent.findUniqueOrThrow({ where: { id: losingEventId } })
      .then((event) => event.lifecycleStatus),
    "DRAFT",
  );
  assert.equal(
    await prisma.eventStatusHistory.count({ where: { cleanupEventId: losingEventId } }),
    0,
  );
  assert.equal(
    await prisma.auditLog.count({ where: { action: "CLEANUP_EVENT_PUBLISHED", entityId: losingEventId } }),
    0,
  );
  assert.equal(
    await prisma.incidentStatusHistory.count({
      where: { incidentId: claimIncidentId, toStatus: "CLEANUP_ORGANIZED" },
    }),
    1,
  );
});

test("a citizen joins immediately, retries idempotently, updates availability, withdraws, and rejoins", async () => {
  const eventId = await createDirectDraft("EVT-04 citizen participation event");
  await makeDraftPublishable(
    identities.adminA.token,
    organizationAId,
    eventId,
    identities.memberA.membershipId,
  );
  const secondSession = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/sessions`,
    {
      method: "POST",
      body: JSON.stringify({
        sessionDate: "2099-09-02",
        startTime: "09:00:00",
        endTime: "12:00:00",
      }),
    },
  );
  assert.equal(secondSession.status, 201);
  const secondSessionId = (await secondSession.json()).data.id as string;
  const published = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/publish`,
    { method: "POST" },
  );
  assert.equal(published.status, 200);
  const firstSessionId = (await published.json()).data.event.sessions[0].id as string;

  const [firstJoin, retryJoin] = await Promise.all([
    request(identities.reporter.token, `/events/${eventId}/participation`, {
      method: "POST",
      body: JSON.stringify({ sessionIds: [firstSessionId] }),
    }),
    request(identities.reporter.token, `/events/${eventId}/participation`, {
      method: "POST",
      body: JSON.stringify({ sessionIds: [firstSessionId] }),
    }),
  ]);
  assert.deepEqual([firstJoin.status, retryJoin.status].sort(), [200, 201]);
  assert.equal(await prisma.eventParticipant.count({ where: { cleanupEventId: eventId, userId: identities.reporter.id } }), 1);
  const participant = await prisma.eventParticipant.findUniqueOrThrow({
    where: { cleanupEventId_userId: { cleanupEventId: eventId, userId: identities.reporter.id } },
  });
  assert.equal(await prisma.participantSessionAvailability.count({ where: { participantId: participant.id } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { action: "EVENT_PARTICIPANT_JOINED", entityId: participant.id } }), 1);
  assert.equal(await prisma.notification.count({ where: { userId: identities.reporter.id, type: "EVENT_JOINED", data: { path: ["eventId"], equals: eventId } } }), 1);

  const strangerRead = await request(identities.memberA.token, `/events/${eventId}/participation`);
  assert.equal(strangerRead.status, 200);
  assert.equal((await strangerRead.json()).data, null);

  const availability = await request(
    identities.reporter.token,
    `/events/${eventId}/participation/availability`,
    { method: "PUT", body: JSON.stringify({ sessionIds: [secondSessionId] }) },
  );
  assert.equal(availability.status, 200);
  assert.deepEqual((await availability.json()).data.availableSessionIds, [secondSessionId]);

  const mine = await request(identities.reporter.token, "/event-participations/me?scope=active&limit=20");
  assert.equal(mine.status, 200);
  const mineBody = await mine.json();
  assert.ok(mineBody.data.items.some((item: { event: { id: string } }) => item.event.id === eventId));
  assert.equal(JSON.stringify(mineBody).includes("phoneNumber"), false);
  assert.equal(JSON.stringify(mineBody).includes("coordinators"), false);

  const withdrawn = await request(
    identities.reporter.token,
    `/events/${eventId}/participation/withdraw`,
    { method: "POST" },
  );
  assert.equal(withdrawn.status, 200);
  assert.equal((await withdrawn.json()).data.status, "WITHDRAWN");
  const withdrawalRetry = await request(
    identities.reporter.token,
    `/events/${eventId}/participation/withdraw`,
    { method: "POST" },
  );
  assert.equal(withdrawalRetry.status, 200);
  assert.equal(await prisma.auditLog.count({ where: { action: "EVENT_PARTICIPANT_WITHDRAWN", entityId: participant.id } }), 1);

  const rejoined = await request(identities.reporter.token, `/events/${eventId}/participation`, {
    method: "POST",
    body: JSON.stringify({ sessionIds: [firstSessionId, secondSessionId] }),
  });
  assert.equal(rejoined.status, 201);
  assert.equal((await rejoined.json()).data.rejoined, true);
  assert.equal(await prisma.eventParticipant.count({ where: { cleanupEventId: eventId, userId: identities.reporter.id } }), 1);
  assert.equal(await prisma.participantSessionAvailability.count({ where: { participantId: participant.id } }), 2);
});

test("participation rejects draft events, duplicate selections, and sessions from another event", async () => {
  const draftId = await createDirectDraft("EVT-04 private draft");
  await makeDraftPublishable(
    identities.adminA.token,
    organizationAId,
    draftId,
    identities.memberA.membershipId,
  );
  const draft = await request(identities.adminA.token, `/organizations/${organizationAId}/events/drafts/${draftId}`);
  const foreignSessionId = (await draft.json()).data.sessions[0].id as string;
  const draftJoin = await request(identities.reporter.token, `/events/${draftId}/participation`, {
    method: "POST",
    body: JSON.stringify({ sessionIds: [foreignSessionId] }),
  });
  assert.equal(draftJoin.status, 409);
  assert.equal((await draftJoin.json()).error.code, "EVENT_NOT_JOINABLE");

  const eventId = await createDirectDraft("EVT-04 session-bound event");
  await makeDraftPublishable(identities.adminA.token, organizationAId, eventId, identities.memberA.membershipId);
  const publish = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/publish`, { method: "POST" });
  assert.equal(publish.status, 200);
  const ownSessionId = (await publish.json()).data.event.sessions[0].id as string;

  const duplicate = await request(identities.reporter.token, `/events/${eventId}/participation`, {
    method: "POST",
    body: JSON.stringify({ sessionIds: [ownSessionId, ownSessionId] }),
  });
  assert.equal(duplicate.status, 400);

  const crossEvent = await request(identities.reporter.token, `/events/${eventId}/participation`, {
    method: "POST",
    body: JSON.stringify({ sessionIds: [foreignSessionId] }),
  });
  assert.equal(crossEvent.status, 409);
  assert.equal((await crossEvent.json()).error.code, "SESSION_NOT_AVAILABLE");
  assert.equal(await prisma.eventParticipant.count({ where: { cleanupEventId: eventId, userId: identities.reporter.id } }), 0);
});
