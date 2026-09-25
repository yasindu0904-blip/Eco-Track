import { registerResourceCleanup } from "../../tests/closeTestResources.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

import { createApp } from "../../app.js";
import { prisma } from "../../database/prisma.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import { incidentDependencies } from "../incidents/incident.dependencies.js";
import { cleanupEventDependencies } from "./cleanupEvent.dependencies.js";
import { processDueCleanupEventReminders } from "./reminders/cleanupEventReminder.service.js";
import { MAP_LIMITS } from "../maps/map.constants.js";
import type { SpatialQueryMetric } from "../maps/map.telemetry.js";

const organizationAId = randomUUID();
const organizationBId = randomUUID();
const serviceAreaId = randomUUID();
const serviceAreaBId = randomUUID();
const categoryId = randomUUID();
const visibleIncidentId = randomUUID();
const invisibleIncidentId = randomUUID();
const claimIncidentId = randomUUID();
const lifecycleIncidentId = randomUUID();
const cancellationIncidentId = randomUUID();
const uploadedEventEvidencePaths = new Set<string>();

const identities = {
  adminA: {
    token: "evt02-admin-a",
    id: randomUUID(),
    authUserId: randomUUID(),
    membershipId: randomUUID(),
  },
  memberA: {
    token: "evt02-member-a",
    id: randomUUID(),
    authUserId: randomUUID(),
    membershipId: randomUUID(),
  },
  adminB: {
    token: "evt02-admin-b",
    id: randomUUID(),
    authUserId: randomUUID(),
    membershipId: randomUUID(),
  },
  reporter: {
    token: "evt02-reporter",
    id: randomUUID(),
    authUserId: randomUUID(),
    membershipId: randomUUID(),
  },
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

const identityByToken = new Map<
  string,
  (typeof identities)[keyof typeof identities]
>(Object.values(identities).map((identity) => [identity.token, identity]));

const authenticationDependencies: AuthenticationDependencies = {
  async verifyAccessToken(token) {
    const identity = identityByToken.get(token);
    return identity
      ? {
          authUserId: identity.authUserId,
          email: `${identity.token}-${identity.id}@example.com`,
        }
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
cleanupEventDependencies.spatialQueryObserver = (metric) =>
  spatialMetrics.push(metric);
cleanupEventDependencies.eventEvidenceStorage = {
  async createUploadIntent(storagePath) {
    uploadedEventEvidencePaths.add(storagePath);
    return {
      token: `token-${storagePath}`,
      signedUrl: `https://storage.test/upload/${storagePath}`,
    };
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
    startsAt: "2099-09-01T09:00:00+05:30",
    ...overrides,
  };
}

async function createDirectDraft(
  title = "Direct cleanup draft",
): Promise<string> {
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
        startsAt: "2099-09-01T09:00:00+05:30",
        capacity: 30,
      }),
    },
  );
  assert.equal(update.status, 200);
  const coordinator = await request(
    token,
    `/organizations/${organizationId}/events/${eventId}/coordinators`,
    {
      method: "POST",
      body: JSON.stringify({ membershipId: coordinatorMembershipId }),
    },
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
      {
        id: identities.adminA.membershipId,
        organizationId: organizationAId,
        userId: identities.adminA.id,
        role: "ORG_ADMIN",
        status: "ACTIVE",
        source: "FIRST_ADMIN",
      },
      {
        id: identities.memberA.membershipId,
        organizationId: organizationAId,
        userId: identities.memberA.id,
        role: "ORG_MEMBER",
        status: "ACTIVE",
        source: "ADMIN_ADDED",
      },
      {
        id: identities.adminB.membershipId,
        organizationId: organizationBId,
        userId: identities.adminB.id,
        role: "ORG_ADMIN",
        status: "ACTIVE",
        source: "FIRST_ADMIN",
      },
    ],
  });

  await prisma.incidentCategory.create({
    data: {
      id: categoryId,
      name: `EVT-02 category ${categoryId}`,
      isActive: true,
    },
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
        description:
          "A shared incident used to verify database-backed event claiming.",
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
        description:
          "A shared incident used to verify cancellation and completion.",
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
  await prisma.$executeRaw`
    INSERT INTO "organization_service_areas" (
      "id", "organization_id", "area_name", "boundary", "status",
      "created_at", "updated_at"
    ) VALUES (
      ${serviceAreaBId}::uuid,
      ${organizationBId}::uuid,
      'EVT-02 overlapping service area',
      extensions.ST_GeogFromText(
        'MULTIPOLYGON(((79.90 6.93, 79.98 6.93, 79.98 7.00, 79.90 7.00, 79.90 6.93)))'
      ),
      'ACTIVE'::"ServiceAreaStatus",
      NOW(),
      NOW()
    )
  `;

  const app = createApp(authenticationDependencies, {
    // Direct Prisma fixture changes must be visible to every assertion.
    cleanupEventDependencies: { ...cleanupEventDependencies, cache: undefined },
    incidentDependencies: { ...incidentDependencies, cache: undefined, rateLimit: undefined },
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}/api/v1`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => (error ? reject(error) : resolve()));
    });
  }
  const identityIds = Object.values(identities).map((identity) => identity.id);
  await prisma.userAchievement.deleteMany({
    where: { userId: { in: identityIds } },
  });
  await prisma.contributionEvent.deleteMany({
    where: { userId: { in: identityIds } },
  });
  await prisma.cleanupEvent.deleteMany({
    where: { organizationId: { in: [organizationAId, organizationBId] } },
  });
  await prisma.auditLog.deleteMany({
    where: { organizationId: { in: [organizationAId, organizationBId] } },
  });
  await prisma.organizationServiceArea.deleteMany({
    where: { id: { in: [serviceAreaId, serviceAreaBId] } },
  });
  await prisma.incident.deleteMany({
    where: {
      id: {
        in: [
          visibleIncidentId,
          invisibleIncidentId,
          claimIncidentId,
          lifecycleIncidentId,
          cancellationIncidentId,
        ],
      },
    },
  });
  await prisma.incidentCategory.deleteMany({ where: { id: categoryId } });
  await prisma.cleanupWorkflowStatus.deleteMany({
    where: { organizationId: { in: [organizationAId, organizationBId] } },
  });
  await prisma.organizationMembership.deleteMany({
    where: { organizationId: { in: [organizationAId, organizationBId] } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: [organizationAId, organizationBId] } },
  });
  await prisma.userProfile.deleteMany({
    where: {
      id: { in: Object.values(identities).map((identity) => identity.id) },
    },
  });
});

test("section lists paginate by event date and keep public, nearby, and joined results scoped", async () => {
  const ids: string[] = [];
  for (const day of [3, 1, 1]) {
    const id = await createDirectDraft(`Section pagination cleanup ${day}`);
    await makeDraftPublishable(identities.adminA.token, organizationAId, id, identities.memberA.membershipId);
    const published = await request(identities.adminA.token, `/organizations/${organizationAId}/events/${id}/publish`, { method: "POST" });
    assert.equal(published.status, 200);
    await prisma.cleanupEvent.update({ where: { id }, data: { startsAt: new Date(`2098-01-0${day}T08:00:00Z`) } });
    assert.equal((await request(identities.reporter.token, `/events/${id}/participation`, { method: "POST" })).status, 201);
    ids.push(id);
  }
  const expected = [ids[1]!, ids[2]!].sort().concat(ids[0]!);
  async function collect(path: string, map = false, joined = false) {
    const found: string[] = [];
    const cursors = new Set<string>();
    let cursor: string | null = null;
    do {
      const response = await request(identities.reporter.token, path + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""));
      assert.equal(response.status, 200);
      const page = (await response.json()).data;
      const rows = map ? page.features : page.items;
      assert.equal(rows.length <= 2, true);
      if (!joined) assertPublicEventProjection(rows);
      found.push(...rows.map((item: { id: string; properties?: { id: string }; event?: { id: string } }) => map ? item.properties!.id : joined ? item.event!.id : item.id));
      cursor = page.nextCursor;
      if (cursor) { assert.equal(cursors.has(cursor), false); cursors.add(cursor); }
      assert.ok(cursors.size < 30, "Cursor must advance");
    } while (cursor);
    assert.equal(new Set(found).size, found.length);
    return found.filter(id => ids.includes(id));
  }
  assert.deepEqual(await collect("/events?section=upcoming&limit=2"), expected);
  assert.deepEqual(await collect("/events/nearby?section=upcoming&limit=2&latitude=6.95&longitude=79.9&radiusMeters=2000", true), expected);
  // Participation ID breaks equal-date ties; event dates still advance in ascending order.
  const joined = await collect("/event-participations/me?section=upcoming&limit=2", false, true);
  assert.deepEqual(new Set(joined.slice(0, 2)), new Set(expected.slice(0, 2)));
  assert.equal(joined[2], ids[0]);
  await prisma.cleanupEvent.update({ where: { id: ids[0]! }, data: { startsAt: new Date("2020-01-01T08:00:00Z") } });
  assert.equal((await collect("/events?section=upcoming&limit=2")).includes(ids[0]!), false);
  assert.deepEqual(await collect("/events?section=ongoing&limit=2"), [ids[0]]);
  const otherUser = await request(identities.adminB.token, "/event-participations/me?section=upcoming&limit=20");
  assert.equal((await otherUser.json()).data.items.some((item: { event: { id: string } }) => ids.includes(item.event.id)), false);
  const invalid = await request(identities.reporter.token, "/events?section=unknown");
  assert.equal(invalid.status, 400);
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
    {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated direct cleanup draft" }),
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(
    (await updated.json()).data.title,
    "Updated direct cleanup draft",
  );

  const listed = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts?limit=1`,
  );
  assert.equal(listed.status, 200);
  const page = await listed.json();
  assert.ok(Array.isArray(page.data.items));
  assert.equal("sessions" in page.data.items[0], false);
  assert.ok(Array.isArray(page.data.items[0].coordinators));
});

test("linked drafts require real organization visibility and DRAFT never claims the incident", async () => {
  const rejected = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts`,
    {
      method: "POST",
      body: JSON.stringify(draftInput({ incidentId: invisibleIncidentId })),
    },
  );
  assert.equal(rejected.status, 404);

  const accepted = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts`,
    {
      method: "POST",
      body: JSON.stringify(draftInput({ incidentId: visibleIncidentId })),
    },
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
    {
      method: "PATCH",
      body: JSON.stringify({ incidentId: invisibleIncidentId }),
    },
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
    {
      method: "PATCH",
      body: JSON.stringify({ incidentId: visibleIncidentId }),
    },
  );
  assert.equal(visibleUpdate.status, 200);
  assert.equal((await visibleUpdate.json()).data.incidentId, visibleIncidentId);
  assert.notEqual(linkedDraftId, directDraftId);
});

test("one event date and capacity replace the obsolete session API", async () => {
  const draftId = await createDirectDraft("Single-date cleanup draft");
  const updated = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts/${draftId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        startsAt: "2099-10-02T08:30:00+05:30",
        capacity: 20,
      }),
    },
  );
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).data.capacity, 20);

  const obsoleteSessionRoute = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${draftId}/sessions`,
    { method: "POST", body: JSON.stringify({}) },
  );
  assert.equal(obsoleteSessionRoute.status, 404);
});

test("coordinators must be active same-organization members and can be removed and reassigned", async () => {
  const draftId = await createDirectDraft("Coordinator management draft");
  const route = `/organizations/${organizationAId}/events/${draftId}/coordinators`;

  const memberSelfAssign = await request(identities.memberA.token, route, {
    method: "POST",
    body: JSON.stringify({ membershipId: identities.memberA.membershipId }),
  });
  assert.equal(memberSelfAssign.status, 403);

  const crossTenant = await request(identities.adminA.token, route, {
    method: "POST",
    body: JSON.stringify({ membershipId: identities.adminB.membershipId }),
  });
  assert.equal(crossTenant.status, 400);

  const assigned = await request(identities.adminA.token, route, {
    method: "POST",
    body: JSON.stringify({ membershipId: identities.memberA.membershipId }),
  });
  assert.equal(assigned.status, 201);

  const removed = await request(identities.adminA.token, route, {
    method: "DELETE",
    body: JSON.stringify({ membershipId: identities.memberA.membershipId }),
  });
  assert.equal(removed.status, 204);

  const removedAgain = await request(identities.adminA.token, route, {
    method: "DELETE",
    body: JSON.stringify({ membershipId: identities.memberA.membershipId }),
  });
  assert.equal(removedAgain.status, 404);

  const reassigned = await request(identities.adminA.token, route, {
    method: "POST",
    body: JSON.stringify({ membershipId: identities.memberA.membershipId }),
  });
  assert.equal(reassigned.status, 201);
  assert.equal(
    await prisma.eventCoordinator.count({
      where: {
        cleanupEventId: draftId,
        membershipId: identities.memberA.membershipId,
      },
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
  assert.ok(
    initialBody.data.checks.some((item: { ready: boolean }) => !item.ready),
  );

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
    await prisma.cleanupEvent
      .findUniqueOrThrow({
        where: { id: eventId },
        select: { lifecycleStatus: true },
      })
      .then((event) => event.lifecycleStatus),
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
  assert.equal(
    await prisma.eventStatusHistory.count({
      where: { cleanupEventId: eventId },
    }),
    1,
  );
  assert.equal(
    await prisma.auditLog.count({
      where: { action: "CLEANUP_EVENT_PUBLISHED", entityId: eventId },
    }),
    1,
  );

  const detail = await request(identities.reporter.token, `/events/${eventId}`);
  assert.equal(detail.status, 200);
  const detailBody = (await detail.json()).data as Record<string, unknown>;
  assert.equal("coordinators" in detailBody, false);
  assert.equal("createdByMembershipId" in detailBody, false);
  assert.equal(JSON.stringify(detailBody).includes("officialPhone"), false);
  assert.equal(JSON.stringify(detailBody).includes("notes"), false);
  assertPublicEventProjection(detailBody);
  const joined = await request(
    identities.reporter.token,
    `/events/${eventId}/participation`,
    {
      method: "POST",
    },
  );
  assert.equal(joined.status, 201);

  const listed = await request(identities.reporter.token, "/events?limit=50");
  assert.equal(listed.status, 200);
  assert.ok(
    (await listed.json()).data.items.some(
      (item: { id: string }) => item.id === eventId,
    ),
  );

  const map = await request(
    identities.reporter.token,
    "/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=50",
  );
  assert.equal(map.status, 200);
  const mapBody = (await map.json()).data as {
    features: Array<{
      properties: Record<string, unknown> & { id: string; kind: string };
    }>;
  };
  const marker = mapBody.features.find(
    (feature) => feature.properties.id === eventId,
  );
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
  assert.ok(
    (await boundaryMap.json()).data.features.some(
      (feature: { properties: { id: string } }) =>
        feature.properties.id === eventId,
    ),
  );
  assert.equal(
    (
      await request(
        identities.reporter.token,
        "/events/map?west=80&south=6.8&east=79.8&north=7.1&zoom=12",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        identities.reporter.token,
        "/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=101",
      )
    ).status,
    400,
  );

  const secondMapEventId = await createDirectDraft("Second paged map event");
  await makeDraftPublishable(
    identities.adminA.token,
    organizationAId,
    secondMapEventId,
    identities.memberA.membershipId,
  );
  assert.equal(
    (
      await request(
        identities.adminA.token,
        `/organizations/${organizationAId}/events/${secondMapEventId}/publish`,
        { method: "POST" },
      )
    ).status,
    200,
  );
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
  assert.ok(
    (await nearbyMap.json()).data.features.some(
      (feature: { properties: { id: string } }) =>
        feature.properties.id === eventId,
    ),
  );
  assert.equal(
    (
      await request(
        identities.reporter.token,
        "/events/nearby?latitude=6.9271&longitude=79.8612&radiusMeters=50001",
      )
    ).status,
    400,
  );

  const ownedMap = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=50`,
  );
  assert.equal(ownedMap.status, 200);
  const ownedMarker = (await ownedMap.json()).data.features.find(
    (feature: { properties: { id: string } }) =>
      feature.properties.id === eventId,
  );
  assert.equal(ownedMarker.properties.isOwned, true);
  const privateDraftId = await createDirectDraft("Private draft excluded from other organizations");
  const sharedMapPath = `/organizations/${organizationBId}/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=50`;
  const ownOnly = await request(identities.adminB.token, sharedMapPath);
  assert.equal(ownOnly.status, 200);
  assert.ok(!(await ownOnly.json()).data.features.some((feature: { properties: { id: string } }) => feature.properties.id === eventId));
  const sharedMap = await request(identities.adminB.token, `${sharedMapPath}&includePublic=true`);
  assert.equal(sharedMap.status, 200);
  const sharedMapData = (await sharedMap.json()).data;
  const sharedMarker = sharedMapData.features.find((feature: { properties: { id: string } }) => feature.properties.id === eventId);
  assert.equal(sharedMarker.properties.isOwned, false);
  assert.equal(sharedMarker.properties.incidentId, null);
  assert.ok(!sharedMapData.features.some((feature: { properties: { id: string } }) => feature.properties.id === privateDraftId));
  assertPublicEventProjection(sharedMapData);
  const ownerDraftMap = await request(identities.adminA.token, `/organizations/${organizationAId}/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=100&includePublic=true`);
  assert.equal(ownerDraftMap.status, 200);
  const draftMarker = (await ownerDraftMap.json()).data.features.find((feature: { properties: { id: string } }) => feature.properties.id === privateDraftId);
  assert.equal(draftMarker.properties.status, "DRAFT");
  assert.equal(draftMarker.properties.isOwned, true);

  // Coverage applies even when the viewport includes other organizations' areas.
  const originalEvent = await prisma.cleanupEvent.findUniqueOrThrow({ where: { id: eventId } });
  const readSharedMarkers = async () => {
    const response = await request(identities.adminB.token, `${sharedMapPath}&includePublic=true`);
    assert.equal(response.status, 200);
    return (await response.json()).data.features as Array<{ properties: { id: string; status: string } }>;
  };
  try {
    await prisma.cleanupEvent.update({ where: { id: eventId }, data: { eventLatitude: 6.92, eventLongitude: 79.86 } });
    assert.ok(!(await readSharedMarkers()).some(marker => marker.properties.id === eventId));
    await prisma.cleanupEvent.update({ where: { id: eventId }, data: {
      eventLatitude: originalEvent.eventLatitude, eventLongitude: originalEvent.eventLongitude,
    } });
    await prisma.organizationServiceArea.update({ where: { id: serviceAreaBId }, data: { status: "INACTIVE" } });
    assert.deepEqual(await readSharedMarkers(), []);
  } finally {
    await prisma.cleanupEvent.update({ where: { id: eventId }, data: {
      eventLatitude: originalEvent.eventLatitude, eventLongitude: originalEvent.eventLongitude,
      lifecycleStatus: originalEvent.lifecycleStatus,
      currentWorkflowStatusId: originalEvent.currentWorkflowStatusId,
    } });
    await prisma.organizationServiceArea.update({ where: { id: serviceAreaBId }, data: { status: "ACTIVE" } });
  }

  const ownedEvent = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}`,
  );
  assert.equal(ownedEvent.status, 200);
  assert.equal((await ownedEvent.json()).data.id, eventId);
  assert.equal(
    (
      await request(
        identities.adminB.token,
        `/organizations/${organizationAId}/events/${eventId}`,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        identities.adminB.token,
        `/organizations/${organizationBId}/events/${eventId}`,
      )
    ).status,
    404,
  );
  const eventMapMetrics = spatialMetrics.filter((metric) =>
    metric.operation.startsWith("cleanup_events."),
  );
  assert.ok(
    eventMapMetrics.some(
      (metric) => metric.mode === "VIEWPORT" && metric.projection === "PUBLIC",
    ),
  );
  assert.ok(eventMapMetrics.some((metric) => metric.mode === "RADIUS"));
  assert.ok(
    eventMapMetrics.some((metric) => metric.projection === "ORGANIZATION"),
  );
  assert.ok(
    eventMapMetrics.every(
      (metric) =>
        metric.durationMs >= 0 &&
        metric.resultCount <= MAP_LIMITS.maxPageSize + 1,
    ),
  );
  assert.equal(
    (
      await request(
        identities.adminB.token,
        `/organizations/${organizationAId}/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=50`,
      )
    ).status,
    403,
  );
});

test("linked publication requires VALID review and updates incident, histories, audit, and notification", async () => {
  const create = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts`,
    {
      method: "POST",
      body: JSON.stringify(
        draftInput({
          incidentId: visibleIncidentId,
          title: "Validated incident cleanup",
        }),
      ),
    },
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

  const incident = await prisma.incident.findUniqueOrThrow({
    where: { id: visibleIncidentId },
  });
  assert.equal(incident.status, "CLEANUP_ORGANIZED");
  // Simulate an ongoing cleanup in overlapping service areas.
  await prisma.cleanupEvent.update({ where: { id: eventId }, data: { startsAt: new Date(Date.now() - 60_000) } });
  const sharedMap = await request(identities.adminB.token, `/organizations/${organizationBId}/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&includePublic=true`);
  assert.equal(sharedMap.status, 200);
  const sharedMarker = (await sharedMap.json()).data.features.find((feature: { properties: { id: string } }) => feature.properties.id === eventId);
  assert.equal(sharedMarker.properties.status, "ONGOING");
  assert.equal(sharedMarker.properties.isOwned, false);
  assert.equal(sharedMarker.properties.incidentId, visibleIncidentId);
  const detailResponse = await request(identities.adminB.token, `/organizations/${organizationBId}/incidents/${visibleIncidentId}`);
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json()).data;
  assert.equal(detail.status, "CLEANUP_ORGANIZED");
  assert.equal(detail.activeCleanupEvent.id, eventId);
  assert.equal(detail.activeCleanupEvent.organization.id, organizationAId);
  assertPublicEventProjection(detail.activeCleanupEvent);
  assert.equal(detail.currentReview, null);
  for (const [orgId, token, expectedOwned] of [
    [organizationAId, identities.adminA.token, true],
    [organizationBId, identities.adminB.token, false],
  ] as const) {
    const incidents = await request(token, `/organizations/${orgId}/incidents?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=100`);
    assert.equal(incidents.status, 200);
    const row = (await incidents.json()).data.items.find((item: { id: string }) => item.id === visibleIncidentId);
    assert.equal(row.hasOwnedCleanupEvent, expectedOwned);
  }


  assert.equal(
    await prisma.incidentStatusHistory.count({
      where: {
        incidentId: visibleIncidentId,
        relatedCleanupEventId: eventId,
        toStatus: "CLEANUP_ORGANIZED",
      },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: {
        userId: identities.reporter.id,
        type: "EVENT_PUBLISHED",
        data: { path: ["eventId"], equals: eventId },
      },
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
      {
        method: "POST",
        body: JSON.stringify(
          draftInput({
            incidentId: claimIncidentId,
            title: "Organization A claim",
          }),
        ),
      },
    ),
    request(
      identities.adminB.token,
      `/organizations/${organizationBId}/events/drafts`,
      {
        method: "POST",
        body: JSON.stringify(
          draftInput({
            incidentId: claimIncidentId,
            title: "Organization B claim",
          }),
        ),
      },
    ),
  ]);
  assert.equal(draftA.status, 201);
  assert.equal(draftB.status, 201);
  const eventA = (await draftA.json()).data.id as string;
  const eventB = (await draftB.json()).data.id as string;
  await Promise.all([
    makeDraftPublishable(
      identities.adminA.token,
      organizationAId,
      eventA,
      identities.adminA.membershipId,
    ),
    makeDraftPublishable(
      identities.adminB.token,
      organizationBId,
      eventB,
      identities.adminB.membershipId,
    ),
  ]);

  const responses = await Promise.all([
    request(
      identities.adminA.token,
      `/organizations/${organizationAId}/events/${eventA}/publish`,
      { method: "POST" },
    ),
    request(
      identities.adminB.token,
      `/organizations/${organizationBId}/events/${eventB}/publish`,
      { method: "POST" },
    ),
  ]);
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 409],
  );
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
    await prisma.cleanupEvent
      .findUniqueOrThrow({ where: { id: losingEventId } })
      .then((event) => event.lifecycleStatus),
    "DRAFT",
  );
  assert.equal(
    await prisma.eventStatusHistory.count({
      where: { cleanupEventId: losingEventId },
    }),
    0,
  );
  assert.equal(
    await prisma.auditLog.count({
      where: { action: "CLEANUP_EVENT_PUBLISHED", entityId: losingEventId },
    }),
    0,
  );
  assert.equal(
    await prisma.incidentStatusHistory.count({
      where: { incidentId: claimIncidentId, toStatus: "CLEANUP_ORGANIZED" },
    }),
    1,
  );
});

test("a citizen volunteers with one action, retries idempotently, withdraws, and rejoins", async () => {
  const eventId = await createDirectDraft("EVT-04 citizen participation event");
  await makeDraftPublishable(
    identities.adminA.token,
    organizationAId,
    eventId,
    identities.memberA.membershipId,
  );
  const published = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/publish`,
    { method: "POST" },
  );
  assert.equal(published.status, 200);

  const [firstJoin, retryJoin] = await Promise.all([
    request(identities.reporter.token, `/events/${eventId}/participation`, {
      method: "POST",
    }),
    request(identities.reporter.token, `/events/${eventId}/participation`, {
      method: "POST",
    }),
  ]);
  assert.deepEqual([firstJoin.status, retryJoin.status].sort(), [200, 201]);
  assert.equal(
    await prisma.eventParticipant.count({
      where: { cleanupEventId: eventId, userId: identities.reporter.id },
    }),
    1,
  );
  const participant = await prisma.eventParticipant.findUniqueOrThrow({
    where: {
      cleanupEventId_userId: {
        cleanupEventId: eventId,
        userId: identities.reporter.id,
      },
    },
  });
  assert.equal(
    await prisma.auditLog.count({
      where: { action: "EVENT_PARTICIPANT_JOINED", entityId: participant.id },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: {
        userId: identities.reporter.id,
        type: "EVENT_JOINED",
        data: { path: ["eventId"], equals: eventId },
      },
    }),
    1,
  );

  const strangerRead = await request(
    identities.memberA.token,
    `/events/${eventId}/participation`,
  );
  assert.equal(strangerRead.status, 200);
  assert.equal((await strangerRead.json()).data, null);

  const mine = await request(
    identities.reporter.token,
    "/event-participations/me?scope=active&limit=20",
  );
  assert.equal(mine.status, 200);
  const mineBody = await mine.json();
  assert.ok(
    mineBody.data.items.some(
      (item: { event: { id: string } }) => item.event.id === eventId,
    ),
  );
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
  assert.equal(
    await prisma.auditLog.count({
      where: {
        action: "EVENT_PARTICIPANT_WITHDRAWN",
        entityId: participant.id,
      },
    }),
    1,
  );

  const rejoined = await request(
    identities.reporter.token,
    `/events/${eventId}/participation`,
    {
      method: "POST",
    },
  );
  assert.equal(rejoined.status, 201);
  assert.equal((await rejoined.json()).data.rejoined, true);
  assert.equal(
    await prisma.eventParticipant.count({
      where: { cleanupEventId: eventId, userId: identities.reporter.id },
    }),
    1,
  );
});

test("participation rejects private drafts and request bodies from the removed session flow", async () => {
  const draftId = await createDirectDraft("EVT-04 private draft");
  await makeDraftPublishable(
    identities.adminA.token,
    organizationAId,
    draftId,
    identities.memberA.membershipId,
  );
  const draftJoin = await request(
    identities.reporter.token,
    `/events/${draftId}/participation`,
    {
      method: "POST",
    },
  );
  assert.equal(draftJoin.status, 409);
  assert.equal((await draftJoin.json()).error.code, "EVENT_NOT_JOINABLE");

  const eventId = await createDirectDraft("EVT-04 one-action event");
  await makeDraftPublishable(
    identities.adminA.token,
    organizationAId,
    eventId,
    identities.memberA.membershipId,
  );
  const publish = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/publish`,
    { method: "POST" },
  );
  assert.equal(publish.status, 200);
  const obsoletePayload = await request(
    identities.reporter.token,
    `/events/${eventId}/participation`,
    {
      method: "POST",
      body: JSON.stringify({ sessionIds: [randomUUID()] }),
    },
  );
  assert.equal(obsoletePayload.status, 400);
  assert.equal(
    await prisma.eventParticipant.count({
      where: { cleanupEventId: eventId, userId: identities.reporter.id },
    }),
    0,
  );
});

test("event-level attendance is tenant-safe, idempotent, rewarded once, and private", async () => {
  const eventId = await createDirectDraft(
    "EVT-05 participant operations event",
  );
  await makeDraftPublishable(
    identities.adminA.token,
    organizationAId,
    eventId,
    identities.memberA.membershipId,
  );
  const published = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/publish`,
    { method: "POST" },
  );
  assert.equal(published.status, 200);

  const joined = await request(
    identities.reporter.token,
    `/events/${eventId}/participation`,
    {
      method: "POST",
    },
  );
  assert.equal(joined.status, 201);
  const participantId = (await joined.json()).data.participation.id as string;
  const coordinatorJoin = await request(
    identities.memberA.token,
    `/events/${eventId}/participation`,
    {
      method: "POST",
    },
  );
  assert.equal(coordinatorJoin.status, 201);

  const crossTenant = await request(
    identities.adminB.token,
    `/organizations/${organizationAId}/events/${eventId}/participants`,
  );
  assert.equal(crossTenant.status, 403);
  const coordinatorList = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/${eventId}/participants`,
  );
  assert.equal(coordinatorList.status, 200);
  const coordinatorBody = await coordinatorList.json();
  assert.equal(
    coordinatorBody.data.participants[0].volunteer.phoneNumber,
    "+94770000001",
  );
  const coordinatedEvents = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events?limit=25`,
  );
  assert.equal(coordinatedEvents.status, 200);
  assert.equal(
    (await coordinatedEvents.json()).data.items.some(
      (item: { id: string }) => item.id === eventId,
    ),
    true,
  );
  const coordinatedEvent = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/${eventId}`,
  );
  assert.equal(coordinatedEvent.status, 200);

  const selfView = await request(
    identities.reporter.token,
    `/events/${eventId}/participation`,
  );
  assert.equal(selfView.status, 200);
  const selfBody = await selfView.json();
  assert.equal(selfBody.data.attendanceStatus, "UNMARKED");
  assert.equal(JSON.stringify(selfBody).includes("phoneNumber"), false);

  const tooEarly = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/participants/${participantId}/attendance`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "ATTENDED" }),
    },
  );
  assert.equal(tooEarly.status, 409);

  await prisma.cleanupEvent.update({
    where: { id: eventId },
    data: { startsAt: new Date("2020-01-01T00:00:00.000Z") },
  });
  const attendance = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/participants/${participantId}/attendance`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "ATTENDED" }),
    },
  );
  assert.equal(attendance.status, 200);
  const attendanceRetry = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/participants/${participantId}/attendance`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "ATTENDED" }),
    },
  );
  assert.equal(attendanceRetry.status, 200);
  assert.equal(
    await prisma.contributionEvent.count({
      where: { eventParticipantId: participantId, type: "EVENT_ATTENDED" },
    }),
    1,
  );

  const removed = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/participants/${participantId}/remove`,
    {
      method: "POST",
      body: JSON.stringify({
        reason: "Volunteer requested removal after attendance.",
      }),
    },
  );
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).data.participant.status, "REMOVED");
  assert.equal(
    (
      await prisma.eventParticipant.findUniqueOrThrow({
        where: { id: participantId },
      })
    ).attendanceStatus,
    "ATTENDED",
  );
  assert.equal(
    await prisma.auditLog.count({
      where: { action: "EVENT_PARTICIPANT_REMOVED", entityId: participantId },
    }),
    1,
  );

  assert.equal(
    (
      await prisma.eventCoordinator.deleteMany({
        where: {
          cleanupEventId: eventId,
          membershipId: identities.memberA.membershipId,
        },
      })
    ).count,
    1,
  );
  const ordinaryMemberList = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/${eventId}/participants`,
  );
  assert.equal(ordinaryMemberList.status, 403);
});

test("EVT-06 protects notes/evidence and atomically completes an event with its linked incident", async () => {
  const eventId = await createDirectDraft("EVT-06 complete lifecycle event");
  await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts/${eventId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ incidentId: lifecycleIncidentId }),
    },
  ).then((response) => assert.equal(response.status, 200));
  await makeDraftPublishable(
    identities.adminA.token,
    organizationAId,
    eventId,
    identities.memberA.membershipId,
  );
  const published = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/publish`,
    { method: "POST" },
  );
  assert.equal(published.status, 200);
  const joined = await request(
    identities.reporter.token,
    `/events/${eventId}/participation`,
    {
      method: "POST",
    },
  );
  assert.equal(joined.status, 201);
  const participantId = (await joined.json()).data.participation.id as string;
  const coordinatorJoined = await request(
    identities.memberA.token,
    `/events/${eventId}/participation`,
    {
      method: "POST",
    },
  );
  assert.equal(coordinatorJoined.status, 201);
  const coordinatorParticipantId = (await coordinatorJoined.json()).data
    .participation.id as string;

  const crossTenant = await request(
    identities.adminB.token,
    `/organizations/${organizationAId}/events/${eventId}/operations`,
  );
  assert.equal(crossTenant.status, 403);
  const participantNote = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/${eventId}/notes`,
    {
      method: "POST",
      body: JSON.stringify({
        visibility: "PARTICIPANTS",
        noteText: "Meet at the west entrance before the cleanup starts.",
      }),
    },
  );
  assert.equal(participantNote.status, 201);
  const internalNote = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/notes`,
    {
      method: "POST",
      body: JSON.stringify({
        visibility: "INTERNAL",
        noteText: "Waste collection vehicle is confirmed.",
      }),
    },
  );
  assert.equal(internalNote.status, 201);
  const updates = await request(
    identities.reporter.token,
    `/events/${eventId}/participant-updates`,
  );
  assert.equal(updates.status, 200);
  const updatesBody = await updates.json();
  assert.equal(updatesBody.data.notes.length, 1);
  assert.equal(updatesBody.data.notes[0].visibility, "PARTICIPANTS");
  assert.equal(
    JSON.stringify(updatesBody).includes("Waste collection vehicle"),
    false,
  );

  const intentResponse = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/${eventId}/evidence/upload-intents`,
    {
      method: "POST",
      body: JSON.stringify({
        files: [
          {
            originalFileName: "after.jpg",
            contentType: "image/jpeg",
            sizeBytes: 1_024,
          },
        ],
      }),
    },
  );
  assert.equal(intentResponse.status, 201);
  const intent = (await intentResponse.json()).data[0] as {
    storagePath: string;
  };
  const evidence = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/${eventId}/evidence`,
    {
      method: "POST",
      body: JSON.stringify({
        storagePath: intent.storagePath,
        originalFileName: "after.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1_024,
        type: "AFTER",
        caption: "Cleanup completed",
      }),
    },
  );
  assert.equal(evidence.status, 201);
  assert.match((await evidence.json()).data.url, /storage\.test\/download/);

  const obsoleteSessionEvidence = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/${eventId}/evidence`,
    {
      method: "POST",
      body: JSON.stringify({
        storagePath: intent.storagePath,
        originalFileName: "after.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1_024,
        type: "AFTER",
        sessionId: randomUUID(),
      }),
    },
  );
  assert.equal(obsoleteSessionEvidence.status, 400);

  await prisma.cleanupEvent.update({
    where: { id: eventId },
    data: { startsAt: new Date("2020-01-01T00:00:00.000Z") },
  });
  const attendance = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/${eventId}/participants/${participantId}/attendance`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "ATTENDED" }),
    },
  );
  assert.equal(attendance.status, 200);
  const coordinatorAttendance = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/participants/${coordinatorParticipantId}/attendance`,
    { method: "PATCH", body: JSON.stringify({ status: "ABSENT" }) },
  );
  assert.equal(coordinatorAttendance.status, 200);

  const readinessResponse = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/${eventId}/completion-readiness`,
  );
  assert.equal(readinessResponse.status, 200);
  assert.equal((await readinessResponse.json()).data.ready, true);
  const operations = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/${eventId}/operations`,
  ).then((response) => response.json());
  const completed = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/${eventId}/complete`,
    {
      method: "POST",
      body: JSON.stringify({
        expectedUpdatedAt: operations.data.event.updatedAt,
        notes: "Completion evidence reviewed.",
      }),
    },
  );
  assert.equal(completed.status, 200);
  const completedBody = await completed.json();
  assert.equal(completedBody.data.lifecycleStatus, "COMPLETED");
  assert.equal(completedBody.data.incidentStatus, "RESOLVED");
  assert.equal(completedBody.data.rewardsAwarded, 1);
  assert.equal(
    (
      await prisma.incident.findUniqueOrThrow({
        where: { id: lifecycleIncidentId },
      })
    ).status,
    "RESOLVED",
  );
  assert.equal(
    await prisma.contributionEvent.count({
      where: { cleanupEventId: eventId, type: "EVENT_COMPLETED" },
    }),
    1,
  );
  assert.equal(
    await prisma.auditLog.count({
      where: { action: "CLEANUP_EVENT_COMPLETED", entityId: eventId },
    }),
    1,
  );

  const completionRetry = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/${eventId}/complete`,
    {
      method: "POST",
      body: JSON.stringify({
        expectedUpdatedAt: operations.data.event.updatedAt,
      }),
    },
  );
  assert.equal(completionRetry.status, 200);
  assert.equal((await completionRetry.json()).data.idempotentReplay, true);
  assert.equal(
    await prisma.contributionEvent.count({
      where: { cleanupEventId: eventId, type: "EVENT_COMPLETED" },
    }),
    1,
  );
});

test("a due event reminder reaches volunteers, coordinators, and organization admins once", async () => {
  const eventId = await createDirectDraft("Thirty-minute reminder event");
  await makeDraftPublishable(
    identities.adminA.token,
    organizationAId,
    eventId,
    identities.memberA.membershipId,
  );
  assert.equal(
    (
      await request(
        identities.adminA.token,
        `/organizations/${organizationAId}/events/${eventId}/publish`,
        { method: "POST" },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        identities.reporter.token,
        `/events/${eventId}/participation`,
        { method: "POST" },
      )
    ).status,
    201,
  );
  await prisma.cleanupEventReminder.update({
    where: { cleanupEventId: eventId },
    data: { scheduledFor: new Date(Date.now() - 1_000) },
  });

  assert.equal(
    await processDueCleanupEventReminders(cleanupEventDependencies),
    1,
  );
  assert.equal(
    await processDueCleanupEventReminders(cleanupEventDependencies),
    0,
  );
  assert.equal(
    await prisma.notification.count({
      where: {
        type: "EVENT_REMINDER",
        data: { path: ["eventId"], equals: eventId },
      },
    }),
    3,
  );
});

test("EVT-06 cancellation preserves history and releases a linked incident claim", async () => {
  const eventId = await createDirectDraft("EVT-06 cancellation event");
  await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/drafts/${eventId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ incidentId: cancellationIncidentId }),
    },
  ).then((response) => assert.equal(response.status, 200));
  await makeDraftPublishable(
    identities.adminA.token,
    organizationAId,
    eventId,
    identities.memberA.membershipId,
  );
  assert.equal(
    (
      await request(
        identities.adminA.token,
        `/organizations/${organizationAId}/events/${eventId}/publish`,
        { method: "POST" },
      )
    ).status,
    200,
  );
  const operations = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/operations`,
  ).then((response) => response.json());
  const coordinatorCannotCancel = await request(
    identities.memberA.token,
    `/organizations/${organizationAId}/events/${eventId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        expectedUpdatedAt: operations.data.event.updatedAt,
        reason: "Unsafe weather conditions at the cleanup location.",
      }),
    },
  );
  assert.equal(coordinatorCannotCancel.status, 403);
  const cancelled = await request(
    identities.adminA.token,
    `/organizations/${organizationAId}/events/${eventId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        expectedUpdatedAt: operations.data.event.updatedAt,
        reason: "Unsafe weather conditions at the cleanup location.",
      }),
    },
  );
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).data.incidentStatus, "ACTIVE");
  const reviewViewport = "west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=100";
  const incidentMap = await request(identities.adminA.token, `/organizations/${organizationAId}/incidents?${reviewViewport}`);
  assert.equal(incidentMap.status, 200);
  const returnedIncident = (await incidentMap.json()).data.items.find((item: { id: string }) => item.id === cancellationIncidentId);
  assert.equal(returnedIncident.status, "ACTIVE");
  const eventMap = await request(identities.adminA.token, `/organizations/${organizationAId}/events/map?${reviewViewport}&includePublic=true`);
  assert.equal(eventMap.status, 200);
  assert.ok(!(await eventMap.json()).data.features.some((marker: { properties: { id: string } }) => marker.properties.id === eventId));
  const incidentDetail = await request(identities.adminA.token, `/organizations/${organizationAId}/incidents/${cancellationIncidentId}`);
  assert.equal(incidentDetail.status, 200);
  assert.equal((await incidentDetail.json()).data.activeCleanupEvent, null);

  assert.equal(
    (
      await prisma.incident.findUniqueOrThrow({
        where: { id: cancellationIncidentId },
      })
    ).status,
    "ACTIVE",
  );
  assert.equal(
    await prisma.eventStatusHistory.count({
      where: {
        cleanupEventId: eventId,
        toStatus: { mappedLifecycleStatus: "CANCELLED" },
      },
    }),
    1,
  );
  assert.equal(
    await prisma.cleanupEvent.count({
      where: {
        incidentId: cancellationIncidentId,
        lifecycleStatus: "PUBLISHED",
      },
    }),
    0,
  );
});

test("past and cancelled sections expose only matching public records, newest event first", async () => {
  for (const [section, lifecycle] of [["past", "COMPLETED"], ["cancelled", "CANCELLED"]]) {
    const response = await request(identities.reporter.token, `/events?section=${section}&limit=50`);
    assert.equal(response.status, 200);
    const items = (await response.json()).data.items as { id: string; lifecycleStatus: string; startsAt: string }[];
    assert.ok(items.length > 0);
    assert.ok(items.every(item => item.lifecycleStatus === lifecycle));
    assertPublicEventProjection(items);
    const dates = items.map(item => new Date(item.startsAt).getTime());
    assert.deepEqual(dates, [...dates].sort((a, b) => b - a));
    const nearby = await request(identities.reporter.token, `/events/nearby?section=${section}&limit=50&latitude=6.95&longitude=79.9&radiusMeters=25000`);
    assert.equal(nearby.status, 200);
    assert.ok((await nearby.json()).data.features.every((feature: { properties: { status: string } }) => feature.properties.status === lifecycle));
  }
});

registerResourceCleanup();


test("review maps include only owned drafts and public active events before pagination", async () => {
  const excluded = await prisma.cleanupEvent.findMany({
    where: { organizationId: { in: [organizationAId, organizationBId] }, lifecycleStatus: { in: ["DRAFT", "COMPLETED", "CANCELLED"] } },
    select: { id: true, organizationId: true, lifecycleStatus: true },
  });
  assert.deepEqual(new Set(excluded.map(event => event.lifecycleStatus)), new Set(["DRAFT", "COMPLETED", "CANCELLED"]));
  for (const [organizationId, token] of [[organizationAId, identities.adminA.token], [organizationBId, identities.adminB.token]]) {
    let cursor: string | null = null;
    const ids: string[] = [];
    do {
      const response = await request(token!, `/organizations/${organizationId}/events/map?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=1&includePublic=true${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      assert.equal(response.status, 200);
      const page = (await response.json()).data;
      for (const feature of page.features) {
        assert.ok(["UPCOMING", "ONGOING", "DRAFT"].includes(feature.properties.status));
        if (feature.properties.status === "DRAFT") {
          assert.equal(feature.properties.organizationId, organizationId);
          assert.equal(feature.properties.isOwned, true);
        }
        assert.ok(!excluded.some(event => event.id === feature.properties.id &&
          (event.lifecycleStatus !== "DRAFT" || event.organizationId !== organizationId)));
        ids.push(feature.properties.id);
      }
      cursor = page.nextCursor;
    } while (cursor);
    assert.ok(ids.length > 0);
    assert.equal(new Set(ids).size, ids.length);
  }
});


test("awaiting cleanup includes cancelled claims and private drafts but excludes published, resolved, and distant incidents", async () => {
  const draft = await request(identities.adminA.token, `/organizations/${organizationAId}/events/drafts`, {
    method: "POST", body: JSON.stringify(draftInput({ incidentId: cancellationIncidentId, title: "Private retry draft" })),
  });
  assert.equal(draft.status, 201);
  const query = `latitude=6.96&longitude=79.92&radiusMeters=3000&categoryId=${categoryId}&awaitingCleanup=true&limit=1`;
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const response = await request(identities.reporter.token, `/incidents/nearby?${query}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    assert.equal(response.status, 200);
    const page = (await response.json()).data;
    for (const item of page.items) {
      assert.ok(["ACTIVE", "EXPIRED"].includes(item.status));
      assert.equal("reporterUserId" in item, false);
      assert.equal("cleanupEvents" in item, false);
      ids.push(item.id);
    }
    cursor = page.nextCursor;
  } while (cursor);
  assert.deepEqual(ids, [cancellationIncidentId]);
  assert.ok(!ids.includes(visibleIncidentId), "Published cleanups are excluded");
  assert.ok(!ids.includes(lifecycleIncidentId), "Resolved incidents are excluded");
  assert.ok(!ids.includes(invisibleIncidentId), "Incidents outside the radius are excluded");
  await prisma.incident.update({ where: { id: cancellationIncidentId }, data: { status: "EXPIRED" } });
  const expired = await request(identities.reporter.token, `/incidents/nearby?${query}`);
  assert.ok((await expired.json()).data.items.some((item: { id: string }) => item.id === cancellationIncidentId));
  await prisma.incident.update({ where: { id: cancellationIncidentId }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  const archived = await request(identities.reporter.token, `/incidents/nearby?${query}`);
  assert.deepEqual((await archived.json()).data.items, []);
});
