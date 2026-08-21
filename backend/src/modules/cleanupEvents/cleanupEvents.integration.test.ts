import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

import { createApp } from "../../app.js";
import { prisma } from "../../database/prisma.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import { cleanupEventDependencies } from "./cleanupEvent.dependencies.js";
import { MAP_LIMITS } from "../maps/map.constants.js";
import type { SpatialQueryMetric } from "../maps/map.telemetry.js";

const organizationAId = randomUUID();
const organizationBId = randomUUID();
const serviceAreaId = randomUUID();
const categoryId = randomUUID();
const visibleIncidentId = randomUUID();
const invisibleIncidentId = randomUUID();
const claimIncidentId = randomUUID();
const lifecycleIncidentId = randomUUID();
const cancellationIncidentId = randomUUID();
const uploadedEventEvidencePaths = new Set<string>();

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
const spatialMetrics: SpatialQueryMetric[] = [];
cleanupEventDependencies.spatialQueryObserver = (metric) => spatialMetrics.push(metric);
cleanupEventDependencies.eventEvidenceStorage = {
  async createUploadIntent(storagePath) {
    uploadedEventEvidencePaths.add(storagePath);
    return { token: `token-${storagePath}`, signedUrl: `https://storage.test/upload/${storagePath}` };
  },
  async objectExists(storagePath) {
    return uploadedEventEvidencePaths.has(storagePath);
  },
  async createDownloadUrl(storagePath) {
    return `https://storage.test/download/${storagePath}`;
  },
};

const PUBLIC_EVENT_FORBIDDEN_FIELDS = new Set([
  "createdByMembershipId",
  "officialEmail",
  "officialPhone",
  "phoneNumber",
  "privateNotes",
  "reviewerName",
  "participants",
  "coordinators",
  "notes",
  "storagePath",
]);

function assertPublicEventProjection(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertPublicEventProjection);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    assert.equal(
      PUBLIC_EVENT_FORBIDDEN_FIELDS.has(key),
      false,
      `Public event projection unexpectedly contained ${key}.`,
    );
    assertPublicEventProjection(nested);
  }
}

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
      {
        id: lifecycleIncidentId,
        reporterUserId: identities.reporter.id,
        submissionId: randomUUID(),
        categoryId,
        title: "EVT-06 lifecycle incident",
        description: "A shared incident used to verify cancellation and completion.",
        severity: "HIGH",
        latitude: 6.96,
        longitude: 79.92,
        highlightUntil: new Date(now + 86_400_000),
        archiveAfter: new Date(now + 604_800_000),
      },
      {
        id: cancellationIncidentId,
        reporterUserId: identities.reporter.id,
        submissionId: randomUUID(),
        categoryId,
        title: "EVT-06 cancellation incident",
        description: "A shared incident used to verify atomic claim release.",
        severity: "MEDIUM",
        latitude: 6.96,
        longitude: 79.92,
        highlightUntil: new Date(now + 86_400_000),
        archiveAfter: new Date(now + 604_800_000),
      },
    ],
  });
  await prisma.incidentReview.create({
    data: {
      incidentId: lifecycleIncidentId,
      organizationId: organizationAId,
      status: "VALID",
      reviewedByMembershipId: identities.adminA.membershipId,
      reviewedAt: new Date(),
    },
  });
  await prisma.incidentReview.create({
    data: {
      incidentId: cancellationIncidentId,
      organizationId: organizationAId,
      status: "VALID",
      reviewedByMembershipId: identities.adminA.membershipId,
      reviewedAt: new Date(),
    },
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
  const identityIds = Object.values(identities).map((identity) => identity.id);
  await prisma.userAchievement.deleteMany({ where: { userId: { in: identityIds } } });
  await prisma.contributionEvent.deleteMany({ where: { userId: { in: identityIds } } });
  await prisma.cleanupEvent.deleteMany({
    where: { organizationId: { in: [organizationAId, organizationBId] } },
  });
  await prisma.auditLog.deleteMany({
    where: { organizationId: { in: [organizationAId, organizationBId] } },
  });
  await prisma.organizationServiceArea.deleteMany({ where: { id: serviceAreaId } });
  await prisma.incident.deleteMany({ where: { id: { in: [visibleIncidentId, invisibleIncidentId, claimIncidentId, lifecycleIncidentId, cancellationIncidentId] } } });
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
  assertPublicEventProjection(detailBody);
  const sessionId = (detailBody.sessions as Array<{ id: string }>)[0]!.id;
  const joined = await request(identities.reporter.token, `/events/${eventId}/participation`, {
    method: "POST",
    body: JSON.stringify({ sessionIds: [sessionId] }),
  });
  assert.equal(joined.status, 201);

  const listed = await request(identities.reporter.token, "/events?limit=50");
  assert.equal(listed.status, 200);
  assert.ok((await listed.json()).data.items.some((item: { id: string }) => item.id === eventId));

  const map = await request(
    identities.reporter.token,
    "/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=50",
  );
  assert.equal(map.status, 200);
  const mapBody = (await map.json()).data as { features: Array<{ properties: Record<string, unknown> & { id: string; kind: string } }> };
  const marker = mapBody.features.find((feature) => feature.properties.id === eventId);
  assert.equal(marker?.properties.kind, "CLEANUP_EVENT");
  assert.equal(marker?.properties.organizationId, organizationAId);
  assert.equal(marker?.properties.isJoined, true);
  assert.equal("officialPhone" in (marker?.properties ?? {}), false);
  assert.equal("privateNotes" in (marker?.properties ?? {}), false);
  assertPublicEventProjection(mapBody);
  assert.ok(
    Buffer.byteLength(JSON.stringify(mapBody), "utf8") < 64 * 1024,
    "A small event marker page should remain a compact public projection.",
  );

  const boundaryMap = await request(
    identities.reporter.token,
    "/events/map?west=79.9&south=6.95&east=80&north=7.1&zoom=12&limit=50",
  );
  assert.equal(boundaryMap.status, 200);
  assert.ok((await boundaryMap.json()).data.features.some(
    (feature: { properties: { id: string } }) => feature.properties.id === eventId,
  ));
  assert.equal((await request(
    identities.reporter.token,
    "/events/map?west=80&south=6.8&east=79.8&north=7.1&zoom=12",
  )).status, 400);
  assert.equal((await request(
    identities.reporter.token,
    "/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=101",
  )).status, 400);

  const secondMapEventId = await createDirectDraft("Second paged map event");
  await makeDraftPublishable(
    identities.adminA.token,
    organizationAId,
    secondMapEventId,
    identities.memberA.membershipId,
  );
  assert.equal((await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${secondMapEventId}/publish`,
    { method: "POST" },
  )).status, 200);
  const firstMapPage = await request(
    identities.reporter.token,
    "/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=1",
  );
  const firstMapPageData = (await firstMapPage.json()).data as {
    features: Array<{ properties: { id: string } }>;
    nextCursor: string | null;
  };
  assert.equal(firstMapPageData.features.length, 1);
  assert.ok(firstMapPageData.nextCursor);
  const secondMapPage = await request(
    identities.reporter.token,
    `/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=1&cursor=${encodeURIComponent(firstMapPageData.nextCursor!)}`,
  );
  const secondMapPageData = (await secondMapPage.json()).data as {
    features: Array<{ properties: { id: string } }>;
  };
  assert.notEqual(
    secondMapPageData.features[0]?.properties.id,
    firstMapPageData.features[0]?.properties.id,
  );

  const nearbyMap = await request(
    identities.reporter.token,
    "/events/nearby?latitude=6.9271&longitude=79.8612&radiusMeters=10000&limit=50",
  );
  assert.equal(nearbyMap.status, 200);
  assert.ok((await nearbyMap.json()).data.features.some(
    (feature: { properties: { id: string } }) => feature.properties.id === eventId,
  ));
  assert.equal((await request(
    identities.reporter.token,
    "/events/nearby?latitude=6.9271&longitude=79.8612&radiusMeters=50001",
  )).status, 400);

  const ownedMap = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=50`,
  );
  assert.equal(ownedMap.status, 200);
  const ownedMarker = (await ownedMap.json()).data.features.find(
    (feature: { properties: { id: string } }) => feature.properties.id === eventId,
  );
  assert.equal(ownedMarker.properties.isOwned, true);
  const ownedEvent = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}`,
  );
  assert.equal(ownedEvent.status, 200);
  assert.equal((await ownedEvent.json()).data.id, eventId);
  assert.equal((await request(
    identities.adminB.token,
    `/organizations/${organizationAId}/events/${eventId}`,
  )).status, 403);
  assert.equal((await request(
    identities.adminB.token,
    `/organizations/${organizationBId}/events/${eventId}`,
  )).status, 404);
  const eventMapMetrics = spatialMetrics.filter((metric) => metric.operation.startsWith("cleanup_events."));
  assert.ok(eventMapMetrics.some((metric) => metric.mode === "VIEWPORT" && metric.projection === "PUBLIC"));
  assert.ok(eventMapMetrics.some((metric) => metric.mode === "RADIUS"));
  assert.ok(eventMapMetrics.some((metric) => metric.projection === "ORGANIZATION"));
  assert.ok(eventMapMetrics.every(
    (metric) => metric.durationMs >= 0 && metric.resultCount <= MAP_LIMITS.maxPageSize + 1,
  ));
  assert.equal((await request(
    identities.adminB.token,
    `/organizations/${organizationAId}/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=50`,
  )).status, 403);
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

test("EVT-05 safely allocates volunteers, records attendance once, and preserves contact privacy", async () => {
  const eventId = await createDirectDraft("EVT-05 participant operations event");
  await makeDraftPublishable(identities.adminA.token, organizationAId, eventId, identities.memberA.membershipId);
  const secondSessionResponse = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/sessions`, {
    method: "POST",
    body: JSON.stringify({ sessionDate: "2099-09-02", startTime: "09:00:00", endTime: "12:00:00", capacity: 1 }),
  });
  assert.equal(secondSessionResponse.status, 201);
  const secondSessionId = (await secondSessionResponse.json()).data.id as string;
  const published = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/publish`, { method: "POST" });
  assert.equal(published.status, 200);
  const sessionId = (await published.json()).data.event.sessions[0].id as string;
  await prisma.eventSession.update({ where: { id: sessionId }, data: { capacity: 1 } });

  const joined = await request(identities.reporter.token, `/events/${eventId}/participation`, {
    method: "POST",
    body: JSON.stringify({ sessionIds: [sessionId, secondSessionId] }),
  });
  assert.equal(joined.status, 201);
  const participantId = (await joined.json()).data.participation.id as string;
  const coordinatorJoin = await request(identities.memberA.token, `/events/${eventId}/participation`, {
    method: "POST",
    body: JSON.stringify({ sessionIds: [sessionId] }),
  });
  assert.equal(coordinatorJoin.status, 201);
  const coordinatorParticipantId = (await coordinatorJoin.json()).data.participation.id as string;

  const crossTenant = await request(identities.adminB.token, `/organizations/${organizationAId}/events/${eventId}/participants`);
  assert.equal(crossTenant.status, 403);
  const coordinatorList = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/participants`);
  assert.equal(coordinatorList.status, 200);
  const coordinatorBody = await coordinatorList.json();
  assert.equal(coordinatorBody.data.participants[0].volunteer.phoneNumber, "+94770000001");
  const coordinatedEvents = await request(identities.memberA.token, `/organizations/${organizationAId}/events?limit=25`);
  assert.equal(coordinatedEvents.status, 200);
  assert.equal((await coordinatedEvents.json()).data.items.some((item: { id: string }) => item.id === eventId), true);
  const coordinatedEvent = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}`);
  assert.equal(coordinatedEvent.status, 200);

  const allocated = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/allocations`, {
    method: "POST",
    body: JSON.stringify({ participantId, sessionId }),
  });
  assert.equal(allocated.status, 201);
  const allocationId = (await allocated.json()).data.id as string;
  const allocationRetry = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/allocations`, {
    method: "POST",
    body: JSON.stringify({ participantId, sessionId }),
  });
  assert.equal(allocationRetry.status, 201);
  assert.equal((await allocationRetry.json()).data.id, allocationId);
  const reallocated = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/allocations/${allocationId}`, {
    method: "PATCH",
    body: JSON.stringify({ sessionId: secondSessionId }),
  });
  assert.equal(reallocated.status, 200);
  assert.equal((await reallocated.json()).data.sessionId, secondSessionId);
  const movedBack = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/allocations/${allocationId}`, {
    method: "PATCH",
    body: JSON.stringify({ sessionId }),
  });
  assert.equal(movedBack.status, 200);
  const capacityRejected = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/allocations`, {
    method: "POST",
    body: JSON.stringify({ participantId: coordinatorParticipantId, sessionId }),
  });
  assert.equal(capacityRejected.status, 409);
  assert.equal((await capacityRejected.json()).error.code, "SESSION_CAPACITY_REACHED");
  const allocationRemoved = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/allocations/${allocationId}/remove`, { method: "POST" });
  assert.equal(allocationRemoved.status, 200);
  assert.equal((await allocationRemoved.json()).data.status, "REMOVED");
  const allocationRestored = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/allocations`, {
    method: "POST",
    body: JSON.stringify({ participantId, sessionId }),
  });
  assert.equal(allocationRestored.status, 201);
  assert.equal((await allocationRestored.json()).data.id, allocationId);

  const selfView = await request(identities.reporter.token, `/events/${eventId}/participation`);
  assert.equal(selfView.status, 200);
  const selfBody = await selfView.json();
  assert.equal(selfBody.data.allocations[0].id, allocationId);
  assert.equal(JSON.stringify(selfBody).includes("phoneNumber"), false);

  await prisma.eventSession.update({
    where: { id: sessionId },
    data: { sessionDate: new Date("2020-01-01T00:00:00.000Z"), startTime: new Date("1970-01-01T00:00:00.000Z") },
  });
  const attendance = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/allocations/${allocationId}/attendance`, {
    method: "PATCH",
    body: JSON.stringify({ status: "ATTENDED" }),
  });
  assert.equal(attendance.status, 200);
  const attendanceRetry = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/allocations/${allocationId}/attendance`, {
    method: "PATCH",
    body: JSON.stringify({ status: "ATTENDED" }),
  });
  assert.equal(attendanceRetry.status, 200);
  assert.equal(await prisma.contributionEvent.count({ where: { sessionAllocationId: allocationId } }), 1);

  const removed = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/participants/${participantId}/remove`, {
    method: "POST",
    body: JSON.stringify({ reason: "Volunteer requested removal after attendance." }),
  });
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).data.participant.status, "REMOVED");
  assert.equal(await prisma.sessionAllocation.findUniqueOrThrow({ where: { id: allocationId } }).then(({ status }) => status), "ATTENDED");
  assert.equal(await prisma.auditLog.count({ where: { action: "EVENT_PARTICIPANT_REMOVED", entityId: participantId } }), 1);

  assert.equal((await prisma.eventCoordinator.deleteMany({ where: { cleanupEventId: eventId, membershipId: identities.memberA.membershipId } })).count, 1);
  const ordinaryMemberList = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/participants`);
  assert.equal(ordinaryMemberList.status, 403);
});

test("EVT-06 protects notes/evidence and atomically completes an event with its linked incident", async () => {
  const eventId = await createDirectDraft("EVT-06 complete lifecycle event");
  await request(identities.adminA.token, `/organizations/${organizationAId}/events/drafts/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify({ incidentId: lifecycleIncidentId }),
  }).then((response) => assert.equal(response.status, 200));
  await makeDraftPublishable(identities.adminA.token, organizationAId, eventId, identities.memberA.membershipId);
  const published = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/publish`, { method: "POST" });
  assert.equal(published.status, 200);
  const sessionId = (await published.json()).data.event.sessions[0].id as string;

  const joined = await request(identities.reporter.token, `/events/${eventId}/participation`, {
    method: "POST",
    body: JSON.stringify({ sessionIds: [sessionId] }),
  });
  assert.equal(joined.status, 201);
  const participantId = (await joined.json()).data.participation.id as string;
  const coordinatorJoined = await request(identities.memberA.token, `/events/${eventId}/participation`, {
    method: "POST",
    body: JSON.stringify({ sessionIds: [sessionId] }),
  });
  assert.equal(coordinatorJoined.status, 201);
  const coordinatorParticipantId = (await coordinatorJoined.json()).data.participation.id as string;

  const crossTenant = await request(identities.adminB.token, `/organizations/${organizationAId}/events/${eventId}/operations`);
  assert.equal(crossTenant.status, 403);
  const participantNote = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/notes`, {
    method: "POST",
    body: JSON.stringify({ visibility: "PARTICIPANTS", noteText: "Meet at the west entrance before the session." }),
  });
  assert.equal(participantNote.status, 201);
  const internalNote = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/notes`, {
    method: "POST",
    body: JSON.stringify({ visibility: "INTERNAL", noteText: "Waste collection vehicle is confirmed." }),
  });
  assert.equal(internalNote.status, 201);
  const updates = await request(identities.reporter.token, `/events/${eventId}/participant-updates`);
  assert.equal(updates.status, 200);
  const updatesBody = await updates.json();
  assert.equal(updatesBody.data.notes.length, 1);
  assert.equal(updatesBody.data.notes[0].visibility, "PARTICIPANTS");
  assert.equal(JSON.stringify(updatesBody).includes("Waste collection vehicle"), false);

  const intentResponse = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/evidence/upload-intents`, {
    method: "POST",
    body: JSON.stringify({ files: [{ originalFileName: "after.jpg", contentType: "image/jpeg", sizeBytes: 1_024 }] }),
  });
  assert.equal(intentResponse.status, 201);
  const intent = (await intentResponse.json()).data[0] as { storagePath: string };
  const evidence = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/evidence`, {
    method: "POST",
    body: JSON.stringify({
      storagePath: intent.storagePath,
      originalFileName: "after.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1_024,
      type: "AFTER",
      sessionId,
      caption: "Cleanup completed",
    }),
  });
  assert.equal(evidence.status, 201);
  assert.match((await evidence.json()).data.url, /storage\.test\/download/);

  const invalidSessionEvidence = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/evidence`, {
    method: "POST",
    body: JSON.stringify({
      storagePath: intent.storagePath,
      originalFileName: "after.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1_024,
      type: "AFTER",
      sessionId: randomUUID(),
    }),
  });
  assert.equal(invalidSessionEvidence.status, 422);

  const allocated = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/allocations`, {
    method: "POST",
    body: JSON.stringify({ participantId, sessionId }),
  });
  assert.equal(allocated.status, 201);
  const allocationId = (await allocated.json()).data.id as string;
  const coordinatorAllocated = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/allocations`, {
    method: "POST",
    body: JSON.stringify({ participantId: coordinatorParticipantId, sessionId }),
  });
  assert.equal(coordinatorAllocated.status, 201);
  const coordinatorAllocationId = (await coordinatorAllocated.json()).data.id as string;

  let operations = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/operations`).then((response) => response.json());
  const inProgressTarget = operations.data.availableTransitions.find((item: { lifecycleStatus: string }) => item.lifecycleStatus === "IN_PROGRESS");
  const eventInProgress = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/transitions`, {
    method: "POST",
    body: JSON.stringify({ targetWorkflowStatusId: inProgressTarget.id, expectedUpdatedAt: operations.data.event.updatedAt }),
  });
  assert.equal(eventInProgress.status, 200);

  operations = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/operations`).then((response) => response.json());
  let session = operations.data.sessions.find((item: { id: string }) => item.id === sessionId);
  const sessionStarted = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/sessions/${sessionId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "IN_PROGRESS", expectedUpdatedAt: session.updatedAt }),
  });
  assert.equal(sessionStarted.status, 200);
  session = (await sessionStarted.json()).data;
  const sessionCompleted = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/sessions/${sessionId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "COMPLETED", expectedUpdatedAt: session.updatedAt }),
  });
  assert.equal(sessionCompleted.status, 200);

  operations = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/operations`).then((response) => response.json());
  const submittedTarget = operations.data.availableTransitions.find((item: { lifecycleStatus: string }) => item.lifecycleStatus === "COMPLETION_SUBMITTED");
  const submitted = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/transitions`, {
    method: "POST",
    body: JSON.stringify({ targetWorkflowStatusId: submittedTarget.id, expectedUpdatedAt: operations.data.event.updatedAt, notes: "All field work is finished." }),
  });
  assert.equal(submitted.status, 200);

  // Completion review must still allow finalizing existing PLANNED records.
  // The explicit COMPLETED session status counts as started even though this
  // test event uses a future calendar date.
  const attendance = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/allocations/${allocationId}/attendance`, {
    method: "PATCH",
    body: JSON.stringify({ status: "ATTENDED" }),
  });
  assert.equal(attendance.status, 200);
  const removedDuringFinalization = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/allocations/${coordinatorAllocationId}/remove`,
    { method: "POST" },
  );
  assert.equal(removedDuringFinalization.status, 200);
  assert.equal((await removedDuringFinalization.json()).data.status, "REMOVED");

  const newAllocationAfterSubmission = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/allocations`,
    {
      method: "POST",
      body: JSON.stringify({ participantId: coordinatorParticipantId, sessionId }),
    },
  );
  assert.equal(newAllocationAfterSubmission.status, 409);
  assert.equal((await newAllocationAfterSubmission.json()).error.code, "EVENT_PARTICIPANT_OPERATIONS_CLOSED");

  const readinessResponse = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/completion-readiness`);
  assert.equal(readinessResponse.status, 200);
  assert.equal((await readinessResponse.json()).data.ready, true);
  operations = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/operations`).then((response) => response.json());
  const completed = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/complete`, {
    method: "POST",
    body: JSON.stringify({ expectedUpdatedAt: operations.data.event.updatedAt, notes: "Completion evidence reviewed." }),
  });
  assert.equal(completed.status, 200);
  const completedBody = await completed.json();
  assert.equal(completedBody.data.lifecycleStatus, "COMPLETED");
  assert.equal(completedBody.data.incidentStatus, "RESOLVED");
  assert.equal(completedBody.data.rewardsAwarded, 1);
  assert.equal((await prisma.incident.findUniqueOrThrow({ where: { id: lifecycleIncidentId } })).status, "RESOLVED");
  assert.equal(await prisma.contributionEvent.count({ where: { cleanupEventId: eventId, type: "EVENT_COMPLETED" } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { action: "CLEANUP_EVENT_COMPLETED", entityId: eventId } }), 1);

  const completionRetry = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/complete`, {
    method: "POST",
    body: JSON.stringify({ expectedUpdatedAt: operations.data.event.updatedAt }),
  });
  assert.equal(completionRetry.status, 200);
  assert.equal((await completionRetry.json()).data.idempotentReplay, true);
  assert.equal(await prisma.contributionEvent.count({ where: { cleanupEventId: eventId, type: "EVENT_COMPLETED" } }), 1);
});

test("EVT-06 cancellation preserves history and releases a linked incident claim", async () => {
  const eventId = await createDirectDraft("EVT-06 cancellation event");
  await request(identities.adminA.token, `/organizations/${organizationAId}/events/drafts/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify({ incidentId: cancellationIncidentId }),
  }).then((response) => assert.equal(response.status, 200));
  await makeDraftPublishable(identities.adminA.token, organizationAId, eventId, identities.memberA.membershipId);
  assert.equal((await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/publish`, { method: "POST" })).status, 200);
  const operations = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/operations`).then((response) => response.json());
  const coordinatorCannotCancel = await request(identities.memberA.token, `/organizations/${organizationAId}/events/${eventId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ expectedUpdatedAt: operations.data.event.updatedAt, reason: "Unsafe weather conditions at the cleanup location." }),
  });
  assert.equal(coordinatorCannotCancel.status, 403);
  const cancelled = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${eventId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ expectedUpdatedAt: operations.data.event.updatedAt, reason: "Unsafe weather conditions at the cleanup location." }),
  });
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).data.incidentStatus, "ACTIVE");
  assert.equal((await prisma.incident.findUniqueOrThrow({ where: { id: cancellationIncidentId } })).status, "ACTIVE");
  assert.equal(await prisma.eventStatusHistory.count({ where: { cleanupEventId: eventId, toStatus: { mappedLifecycleStatus: "CANCELLED" } } }), 1);
  assert.equal(await prisma.cleanupEvent.count({ where: { incidentId: cancellationIncidentId, lifecycleStatus: { in: ["PUBLISHED", "SCHEDULED", "IN_PROGRESS", "COMPLETION_SUBMITTED"] } } }), 0);
});
