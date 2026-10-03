import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

import { createApp } from "../../app.js";
import { prisma } from "../../database/prisma.js";
import { registerResourceCleanup } from "../../tests/closeTestResources.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import { cleanupEventDependencies } from "../cleanupEvents/cleanupEvent.dependencies.js";
import { incidentDependencies } from "../incidents/incident.dependencies.js";

const profileId = randomUUID();
const authUserId = randomUUID();
const organizationId = randomUUID();
const membershipId = randomUUID();
const areaId = randomUUID();
const categoryId = randomUUID();
const insideIncidentId = randomUUID();
const boundaryIncidentId = randomUUID();
const outsideIncidentId = randomUUID();
const eventIds = { upcoming: randomUUID(), ongoing: randomUUID(), past: randomUUID(), cancelled: randomUUID(), outside: randomUUID() };
const token = `gn-map-${profileId}`;
const now = new Date();
let server: Server;
let baseUrl: string;

const authentication: AuthenticationDependencies = {
  async verifyAccessToken(value) {
    return value === token ? { authUserId, email: `gn-map-${profileId}@example.com` } : null;
  },
  async provisionOrSynchronizeProfile() {
    return {
      id: profileId, email: `gn-map-${profileId}@example.com`, fullName: "GN Map Super Admin",
      phoneNumber: "+94770000001", profileCompletedAt: now,
      platformRole: "SUPER_ADMIN", accountStatus: "ACTIVE",
    };
  },
};

before(async () => {
  await prisma.userProfile.create({ data: {
    id: profileId, authUserId, email: `gn-map-${profileId}@example.com`,
    fullName: "GN Map Super Admin", platformRole: "SUPER_ADMIN", profileCompletedAt: now,
  } });
  await prisma.organization.create({ data: {
    id: organizationId, requestedByUserId: profileId, name: "GN Map Test Organization",
    slug: `gn-map-${organizationId}`, officialEmail: `gn-map-${organizationId}@example.com`,
    officialPhone: "+94770000002", officialAddress: "GN map test", status: "ACTIVE",
  } });
  await prisma.organizationMembership.create({ data: {
    id: membershipId, organizationId, userId: profileId, role: "ORG_ADMIN", source: "FIRST_ADMIN",
  } });
  await prisma.incidentCategory.create({ data: { id: categoryId, name: `GN Map ${categoryId}` } });
  await prisma.$executeRaw`
    INSERT INTO administrative_areas (id, official_code, name_en, boundary, source_name, updated_at)
    VALUES (${areaId}::uuid, ${`TEST-${areaId}`}, 'GN map test',
      extensions.ST_GeogFromText('SRID=4326;MULTIPOLYGON(((79.85 6.92,79.87 6.92,79.87 6.94,79.85 6.94,79.85 6.92)))'),
      'Integration test fixture', CURRENT_TIMESTAMP)
  `;
  for (const [id, latitude, longitude, age] of [
    [insideIncidentId, 6.93, 79.86, 2],
    [boundaryIncidentId, 6.92, 79.85, 1],
    [outsideIncidentId, 6.96, 79.88, 0],
  ] as const) {
    await prisma.incident.create({ data: {
      id, submissionId: randomUUID(), reporterUserId: profileId, categoryId,
      title: "GN map test incident", description: "GN boundary and pagination test",
      severity: "LOW", latitude, longitude, reportedAt: new Date(now.getTime() - age * 60_000),
      highlightUntil: new Date(now.getTime() + 2 * 86400_000),
      archiveAfter: new Date(now.getTime() + 7 * 86400_000),
    } });
  }
  const workflows = await prisma.cleanupWorkflowStatus.findMany({ where: { organizationId } });
  for (const [section, id] of Object.entries(eventIds)) {
    const lifecycleStatus = section === "past" ? "COMPLETED" : section === "cancelled" ? "CANCELLED" : "PUBLISHED";
    const workflow = workflows.find(value => value.mappedLifecycleStatus === lifecycleStatus);
    assert.ok(workflow);
    await prisma.cleanupEvent.create({ data: {
      id, organizationId, createdByMembershipId: membershipId, currentWorkflowStatusId: workflow.id,
      lifecycleStatus, title: `GN map ${section}`, description: "GN lifecycle test",
      eventLatitude: section === "outside" ? 6.96 : 6.93,
      eventLongitude: section === "outside" ? 79.88 : 79.86,
      startsAt: new Date(now.getTime() + (section === "upcoming" || section === "outside" ? 1 : -1) * 86400_000),
      publishedAt: now, completedAt: section === "past" ? now : null,
      cancelledAt: section === "cancelled" ? now : null,
      cancellationReason: section === "cancelled" ? "Integration test cancellation" : null,
    } });
  }
  const app = createApp(authentication, {
    incidentDependencies: { ...incidentDependencies, cache: undefined, rateLimit: undefined, spatialQueryObserver: undefined },
    cleanupEventDependencies: { ...cleanupEventDependencies, cache: undefined, spatialQueryObserver: undefined },
  });
  server = await new Promise<Server>(resolve => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await prisma.cleanupEvent.deleteMany({ where: { organizationId } });
  await prisma.incident.deleteMany({ where: { reporterUserId: profileId } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.administrativeArea.deleteMany({ where: { id: areaId } });
  await prisma.incidentCategory.deleteMany({ where: { id: categoryId } });
  await prisma.userProfile.deleteMany({ where: { id: profileId } });
});
registerResourceCleanup();

function query(extra: Record<string, string> = {}) {
  return new URLSearchParams({ west: "79.8", south: "6.8", east: "80", north: "7.1", zoom: "14", administrativeAreaId: areaId, limit: "100", ...extra });
}

async function get(path: string, extra: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}${path}?${query(extra)}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json();
  return { status: response.status, body };
}

test("HTTP incident GN discovery includes boundary points and filters before pagination", async () => {
  const first = await get("/incidents", { limit: "1", categoryId });
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.data.items.map((item: { id: string }) => item.id), [boundaryIncidentId]);
  assert.ok(first.body.data.nextCursor);
  const second = await get("/incidents", { limit: "1", categoryId, cursor: first.body.data.nextCursor });
  assert.equal(second.status, 200);
  assert.deepEqual(second.body.data.items.map((item: { id: string }) => item.id), [insideIncidentId]);
  assert.equal(second.body.data.nextCursor, null);
});

test("HTTP event GN discovery returns the matching lifecycle and excludes outside events", async () => {
  for (const section of ["upcoming", "ongoing", "past", "cancelled"] as const) {
    const result = await get("/events/map", { section });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.deepEqual(result.body.data.features.map((feature: { properties: { id: string } }) => feature.properties.id), [eventIds[section]]);
  }
});

test("HTTP discovery rejects malformed GN IDs and unsupported event categories", async () => {
  for (const path of ["/incidents", "/events/map"]) {
    assert.equal((await get(path, { administrativeAreaId: "invalid" })).status, 400);
  }
  assert.equal((await get("/events/map", { section: "draft" })).status, 400);
});

test("HTTP discovery excludes inactive GN polygons", async () => {
  await prisma.administrativeArea.update({ where: { id: areaId }, data: { isActive: false } });
  try {
    const incidents = await get("/incidents", { categoryId });
    const events = await get("/events/map");
    assert.equal(incidents.status, 200);
    assert.equal(events.status, 200);
    assert.deepEqual(incidents.body.data.items, []);
    assert.deepEqual(events.body.data.features, []);
  } finally {
    await prisma.administrativeArea.update({ where: { id: areaId }, data: { isActive: true } });
  }
});
