import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

import express from "express";

import { authorizationDependencies } from "../../authorization/authorization.dependencies.js";
import { prisma } from "../../database/prisma.js";
import { AccountStatus, PlatformRole } from "../../generated/prisma/enums.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import { cleanupEventDependencies } from "../cleanupEvents/cleanupEvent.dependencies.js";
import type { CleanupEventDependencies } from "../cleanupEvents/cleanupEvent.dependencies.js";
import { createCleanupEventRouter } from "../cleanupEvents/cleanupEvents.routes.js";
import type { IncidentDependencies } from "./incident.dependencies.js";
import { createIncidentRouter } from "./incident.routes.js";
import { MAP_LIMITS } from "../maps/map.constants.js";
import type { SpatialQueryMetric } from "../maps/map.telemetry.js";

const reporterId = randomUUID();
const reporterAuthId = randomUUID();
const otherReporterId = randomUUID();
const otherReporterAuthId = randomUUID();
const organizationMemberId = randomUUID();
const organizationMemberAuthId = randomUUID();
const organizationBAdminId = randomUUID();
const organizationBAdminAuthId = randomUUID();
const superAdminId = randomUUID();
const superAdminAuthId = randomUUID();
const categoryId = randomUUID();
const alternateCategoryId = randomUUID();
const reporterToken = `incident-reporter-${reporterId}`;
const otherToken = `incident-other-${otherReporterId}`;
const organizationMemberToken = `incident-member-${organizationMemberId}`;
const organizationBToken = `incident-organization-b-${organizationBAdminId}`;
const superAdminToken = `incident-super-admin-${superAdminId}`;
const submissionId = randomUUID();
const organizationId = randomUUID();
const organizationMembershipId = randomUUID();
const organizationMemberMembershipId = randomUUID();
const organizationBId = randomUUID();
const organizationBMembershipId = randomUUID();
const serviceAreaId = randomUUID();
const overlappingServiceAreaId = randomUUID();
const organizationBServiceAreaId = randomUUID();
const organizationBInactiveServiceAreaId = randomUUID();
const organizationAWorkflowStatusId = randomUUID();
const inactiveAdministrativeAreaId = randomUUID();
const inactiveAdministrativeServiceAreaId = randomUUID();
const uploadedPaths = new Set<string>();
const eventUploadedPaths = new Set<string>();
const spatialMetrics: SpatialQueryMetric[] = [];

const PUBLIC_FORBIDDEN_FIELDS = new Set([
  "reporterUserId",
  "submissionId",
  "currentReview",
  "currentReviewStatus",
  "privateNotes",
  "reviewedByMembershipId",
  "reviewerName",
  "officialEmail",
  "officialPhone",
  "phoneNumber",
  "participants",
  "coordinators",
]);

const ORGANIZATION_LIST_FORBIDDEN_FIELDS = new Set([
  "reporterUserId",
  "submissionId",
  "currentReview",
  "privateNotes",
  "reviewedByMembershipId",
  "reviewerName",
  "officialEmail",
  "officialPhone",
  "phoneNumber",
  "participants",
  "coordinators",
]);

function assertProjectionExcludesPrivateFields(
  value: unknown,
  forbiddenFields = PUBLIC_FORBIDDEN_FIELDS,
): void {
  if (Array.isArray(value)) {
    value.forEach((nested) => assertProjectionExcludesPrivateFields(nested, forbiddenFields));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    assert.equal(
      forbiddenFields.has(key),
      false,
      `Public projection unexpectedly contained ${key}.`,
    );
    assertProjectionExcludesPrivateFields(nested, forbiddenFields);
  }
}

const profiles = {
  [reporterToken]: {
    id: reporterId,
    authUserId: reporterAuthId,
    email: `incident-${reporterId}@example.com`,
    fullName: "Incident Reporter",
    phoneNumber: "+94770000001",
  },
  [otherToken]: {
    id: otherReporterId,
    authUserId: otherReporterAuthId,
    email: `incident-other-${otherReporterId}@example.com`,
    fullName: "Other Reporter",
    phoneNumber: "+94770000002",
  },
  [organizationMemberToken]: {
    id: organizationMemberId,
    authUserId: organizationMemberAuthId,
    email: `incident-member-${organizationMemberId}@example.com`,
    fullName: "Organization A Member",
    phoneNumber: "+94770000006",
  },
  [organizationBToken]: {
    id: organizationBAdminId,
    authUserId: organizationBAdminAuthId,
    email: `incident-organization-b-${organizationBAdminId}@example.com`,
    fullName: "Organization B Admin",
    phoneNumber: "+94770000004",
  },
  [superAdminToken]: {
    id: superAdminId,
    authUserId: superAdminAuthId,
    email: `incident-super-admin-${superAdminId}@example.com`,
    fullName: "Incident Super Admin",
    phoneNumber: "+94770000007",
  },
};

const authenticationDependencies: AuthenticationDependencies = {
  async verifyAccessToken(token) {
    const profile = profiles[token as keyof typeof profiles];
    return profile ? { authUserId: profile.authUserId, email: profile.email } : null;
  },
  async provisionOrSynchronizeProfile(identity) {
    const profile = Object.values(profiles).find((item) => item.authUserId === identity.authUserId);
    if (!profile) throw new Error("Test profile not found.");
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      phoneNumber: profile.phoneNumber,
      profileCompletedAt: new Date(),
      platformRole: profile.id === superAdminId
        ? PlatformRole.SUPER_ADMIN
        : PlatformRole.USER,
      accountStatus: AccountStatus.ACTIVE,
    };
  },
};

const dependencies: IncidentDependencies = {
  prisma,
  authorization: authorizationDependencies,
  spatialQueryObserver: (metric) => spatialMetrics.push(metric),
  storage: {
    async createUploadIntent(storagePath) {
      uploadedPaths.add(storagePath);
      return { token: `token-${storagePath}`, signedUrl: `https://storage.test/${storagePath}` };
    },
    async objectExists(storagePath) { return uploadedPaths.has(storagePath); },
    async createDownloadUrl(storagePath) { return `https://download.test/${storagePath}`; },
  },
};

const cleanupDependencies: CleanupEventDependencies = {
  ...cleanupEventDependencies,
  eventEvidenceStorage: {
    async createUploadIntent(storagePath) {
      eventUploadedPaths.add(storagePath);
      return { token: `event-token-${storagePath}`, signedUrl: `https://storage.test/${storagePath}` };
    },
    async objectExists(storagePath) { return eventUploadedPaths.has(storagePath); },
    async createDownloadUrl(storagePath) { return `https://download.test/${storagePath}`; },
  },
};

let server: Server | undefined;
let baseUrl = "";
let createdIncidentId = "";
let secondIncidentId = "";

async function request(path: string, token: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

async function createSpatialIncident(input: {
  title: string;
  latitude: number;
  longitude: number;
  categoryId?: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}): Promise<string> {
  const now = Date.now();
  const incident = await prisma.incident.create({
    data: {
      reporterUserId: reporterId,
      submissionId: randomUUID(),
      categoryId: input.categoryId ?? categoryId,
      title: input.title,
      description: `${input.title} is an incident created for spatial acceptance testing.`,
      severity: input.severity ?? "MEDIUM",
      latitude: input.latitude,
      longitude: input.longitude,
      addressText: `${input.title} test location`,
      highlightUntil: new Date(now + 48 * 60 * 60 * 1000),
      archiveAfter: new Date(now + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return incident.id;
}

before(async () => {
  await prisma.userProfile.createMany({
    data: Object.values(profiles).map((profile) => ({
      id: profile.id,
      authUserId: profile.authUserId,
      email: profile.email,
      fullName: profile.fullName,
      phoneNumber: profile.phoneNumber,
      profileCompletedAt: new Date(),
      platformRole: profile.id === superAdminId
        ? PlatformRole.SUPER_ADMIN
        : PlatformRole.USER,
    })),
  });
  await prisma.platformSettings.upsert({
    where: { id: 1 },
    update: { incidentHighlightHours: 48, incidentUnaddressedDays: 7 },
    create: { id: 1, incidentHighlightHours: 48, incidentUnaddressedDays: 7 },
  });
  await prisma.incidentCategory.create({
    data: { id: categoryId, name: `Integration category ${categoryId}`, isActive: true },
  });
  await prisma.incidentCategory.create({
    data: { id: alternateCategoryId, name: `Alternate category ${alternateCategoryId}`, isActive: true },
  });
  await prisma.organization.create({
    data: {
      id: organizationId,
      requestedByUserId: otherReporterId,
      name: `Incident review organization ${organizationId}`,
      slug: `incident-review-${organizationId}`,
      officialEmail: profiles[otherToken].email,
      officialPhone: "+94770000003",
      officialAddress: "Colombo, Sri Lanka",
      status: "ACTIVE",
      memberships: {
        create: [
          {
            id: organizationMembershipId,
            userId: otherReporterId,
            role: "ORG_ADMIN",
            status: "ACTIVE",
            source: "FIRST_ADMIN",
          },
          {
            id: organizationMemberMembershipId,
            userId: organizationMemberId,
            role: "ORG_MEMBER",
            status: "ACTIVE",
            source: "ADMIN_ADDED",
          },
        ],
      },
    },
  });
  await prisma.organization.create({
    data: {
      id: organizationBId,
      requestedByUserId: organizationBAdminId,
      name: `Incident organization B ${organizationBId}`,
      slug: `incident-organization-b-${organizationBId}`,
      officialEmail: profiles[organizationBToken].email,
      officialPhone: "+94770000005",
      officialAddress: "Colombo, Sri Lanka",
      status: "ACTIVE",
      memberships: {
        create: {
          id: organizationBMembershipId,
          userId: organizationBAdminId,
          role: "ORG_ADMIN",
          status: "ACTIVE",
          source: "FIRST_ADMIN",
        },
      },
    },
  });
  await prisma.$executeRaw`
    INSERT INTO "organization_service_areas" (
      "id",
      "organization_id",
      "area_name",
      "boundary",
      "status",
      "created_at",
      "updated_at"
    ) VALUES (
      ${serviceAreaId}::uuid,
      ${organizationId}::uuid,
      'Colombo test GN Division',
      extensions.ST_GeogFromText(
        'MULTIPOLYGON(((79.8612 6.9271, 79.95 6.9271, 79.95 7.05, 79.8612 7.05, 79.8612 6.9271)))'
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
      ${organizationBServiceAreaId}::uuid,
      ${organizationBId}::uuid,
      'Organization B active area',
      extensions.ST_GeogFromText(
        'MULTIPOLYGON(((79.90 6.92, 80.00 6.92, 80.00 7.03, 79.90 7.03, 79.90 6.92)))'
      ),
      'ACTIVE'::"ServiceAreaStatus", NOW(), NOW()
    )
  `;
  await prisma.$executeRaw`
    INSERT INTO "organization_service_areas" (
      "id", "organization_id", "area_name", "boundary", "status",
      "created_at", "updated_at"
    ) VALUES (
      ${organizationBInactiveServiceAreaId}::uuid,
      ${organizationBId}::uuid,
      'Organization B inactive area',
      extensions.ST_GeogFromText(
        'MULTIPOLYGON(((80.04 6.92, 80.12 6.92, 80.12 7.03, 80.04 7.03, 80.04 6.92)))'
      ),
      'INACTIVE'::"ServiceAreaStatus", NOW(), NOW()
    )
  `;
  await prisma.cleanupWorkflowStatus.create({
    data: {
      id: organizationAWorkflowStatusId,
      organizationId,
      code: `HISTORY_${organizationAWorkflowStatusId}`,
      label: "Historical event",
      mappedLifecycleStatus: "DRAFT",
      position: 900,
      isInitial: true,
    },
  });
  await prisma.$executeRaw`
    INSERT INTO "organization_service_areas" (
      "id",
      "organization_id",
      "area_name",
      "boundary",
      "status",
      "created_at",
      "updated_at"
    ) VALUES (
      ${overlappingServiceAreaId}::uuid,
      ${organizationId}::uuid,
      'Overlapping Colombo test GN Division',
      extensions.ST_GeogFromText(
        'MULTIPOLYGON(((79.84 6.90, 79.93 6.90, 79.93 7.02, 79.84 7.02, 79.84 6.90)))'
      ),
      'ACTIVE'::"ServiceAreaStatus",
      NOW(),
      NOW()
    )
  `;

  const app = express();
  app.use(express.json());
  app.use("/api/v1", createIncidentRouter(authenticationDependencies, dependencies));
  app.use(
    "/api/v1",
    createCleanupEventRouter(authenticationDependencies, cleanupDependencies),
  );
  app.use(errorMiddleware);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server?.address() as AddressInfo).port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
  const organizationIds = [organizationId, organizationBId];
  const profileIds = [
    reporterId,
    otherReporterId,
    organizationMemberId,
    organizationBAdminId,
    superAdminId,
  ];
  const contributionIds = (
    await prisma.contributionEvent.findMany({
      where: {
        OR: [
          { userId: { in: profileIds } },
          { recordedByUserId: { in: profileIds } },
          { incident: { reporterUserId: { in: profileIds } } },
          { cleanupEvent: { organizationId: { in: organizationIds } } },
        ],
      },
      select: { id: true },
    })
  ).map(({ id }) => id);
  if (contributionIds.length > 0) {
    await prisma.userAchievement.deleteMany({
      where: { awardedFromContributionId: { in: contributionIds } },
    });
    await prisma.contributionEvent.deleteMany({
      where: { id: { in: contributionIds } },
    });
  }
  await prisma.auditLog.deleteMany({
    where: {
      organizationId: { in: organizationIds },
      action: "INCIDENT_REVIEW_UPDATED",
    },
  });
  await prisma.cleanupEvent.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.incidentReview.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.incident.deleteMany({ where: { reporterUserId: { in: profileIds } } });
  await prisma.cleanupWorkflowStatus.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationServiceArea.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.administrativeArea.deleteMany({ where: { id: inactiveAdministrativeAreaId } });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
  await prisma.incidentCategory.deleteMany({ where: { id: { in: [categoryId, alternateCategoryId] } } });
  await prisma.userProfile.deleteMany({ where: { id: { in: profileIds } } });
});

test("lists active categories", async () => {
  const response = await request("/incident-categories", reporterToken);
  assert.equal(response.status, 200);
  const body = await response.json() as { data: Array<{ id: string }> };
  assert.ok(body.data.some((category) => category.id === categoryId));
});

test("creates evidence intent and one incident/history record", async () => {
  const intentResponse = await request("/incidents/evidence/upload-intents", reporterToken, {
    method: "POST",
    body: JSON.stringify({
      submissionId,
      files: [{ originalFileName: "evidence.jpg", contentType: "image/jpeg", sizeBytes: 1200 }],
    }),
  });
  assert.equal(intentResponse.status, 201);
  const intentBody = await intentResponse.json() as { data: Array<{ storagePath: string }> };
  const storagePath = intentBody.data[0]?.storagePath;
  assert.ok(storagePath);

  const createBody = {
    submissionId,
    categoryId,
    title: "Waste blocking a test canal",
    description: "A large pile of plastic waste is blocking water flow in the canal.",
    severity: "HIGH",
    latitude: 6.9271,
    longitude: 79.8612,
    addressText: "Integration test canal",
    evidence: [{
      storagePath,
      originalFileName: "evidence.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1200,
      sortOrder: 0,
    }],
  };
  const response = await request("/incidents", reporterToken, {
    method: "POST",
    body: JSON.stringify(createBody),
  });
  assert.equal(response.status, 201);
  const body = await response.json() as { data: { id: string; status: string; statusHistory: unknown[]; reportedAt: string; highlightUntil: string; archiveAfter: string } };
  createdIncidentId = body.data.id;
  assert.equal(body.data.status, "ACTIVE");
  assert.equal(body.data.statusHistory.length, 1);
  assert.equal(
    new Date(body.data.highlightUntil).getTime() - new Date(body.data.reportedAt).getTime(),
    48 * 60 * 60 * 1000,
  );
  assert.equal(
    new Date(body.data.archiveAfter).getTime() - new Date(body.data.highlightUntil).getTime(),
    7 * 24 * 60 * 60 * 1000,
  );

  const replay = await request("/incidents", reporterToken, {
    method: "POST",
    body: JSON.stringify(createBody),
  });
  assert.equal(replay.status, 200);
  const replayBody = await replay.json() as { data: { id: string }; meta: { idempotentReplay: boolean } };
  assert.equal(replayBody.data.id, createdIncidentId);
  assert.equal(replayBody.meta.idempotentReplay, true);
  assert.equal(await prisma.incident.count({ where: { reporterUserId: reporterId } }), 1);
});

test("lists own reports and protects the own-detail route", async () => {
  const mine = await request("/incidents/me?limit=20", reporterToken);
  assert.equal(mine.status, 200);
  const mineBody = await mine.json() as { data: { items: Array<{ id: string }> } };
  assert.ok(mineBody.data.items.some((item) => item.id === createdIncidentId));

  const forbiddenOwnProjection = await request(`/incidents/me/${createdIncidentId}`, otherToken);
  assert.equal(forbiddenOwnProjection.status, 404);

  const publicSafe = await request(`/incidents/${createdIncidentId}`, otherToken);
  assert.equal(publicSafe.status, 200);
  const publicBody = await publicSafe.json() as { data: Record<string, unknown> };
  assert.equal("reporterUserId" in publicBody.data, false);
  assert.equal("submissionId" in publicBody.data, false);
});

test("public viewport and nearby discovery are bounded, private-safe, and paginated", async () => {
  const secondResponse = await request("/incidents", reporterToken, {
    method: "POST",
    body: JSON.stringify({
      submissionId: randomUUID(),
      categoryId,
      title: "Nearby waste accumulation",
      description: "A second report used to verify stable spatial pagination.",
      severity: "MEDIUM",
      latitude: 6.928,
      longitude: 79.862,
      addressText: "Near the integration test canal",
      evidence: [],
    }),
  });
  assert.equal(secondResponse.status, 201);
  secondIncidentId = (
    await secondResponse.json() as { data: { id: string } }
  ).data.id;

  const viewportQuery =
    `west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=1&categoryId=${categoryId}`;
  const unauthenticated = await fetch(
    `${baseUrl}/api/v1/incidents?${viewportQuery}`,
  );
  assert.equal(unauthenticated.status, 401);

  const firstPageResponse = await request(
    `/incidents?${viewportQuery}`,
    otherToken,
  );
  assert.equal(firstPageResponse.status, 200);
  const firstPage = await firstPageResponse.json() as {
    data: {
      items: Array<Record<string, unknown> & { id: string }>;
      nextCursor: string | null;
    };
  };
  assert.equal(firstPage.data.items.length, 1);
  assert.ok(firstPage.data.nextCursor);
  const firstItem = firstPage.data.items[0]!;
  assert.equal("reporterUserId" in firstItem, false);
  assert.equal("submissionId" in firstItem, false);
  assert.equal("description" in firstItem, false);
  assert.equal("currentReviewStatus" in firstItem, false);
  assert.equal(typeof firstItem.falseReviewCount, "number");
  assertProjectionExcludesPrivateFields(firstPage.data);
  assert.ok(
    Buffer.byteLength(JSON.stringify(firstPage.data), "utf8") < 64 * 1024,
    "A one-item incident map page should remain a compact public projection.",
  );

  const secondPageResponse = await request(
    `/incidents?${viewportQuery}&cursor=${encodeURIComponent(firstPage.data.nextCursor!)}`,
    otherToken,
  );
  assert.equal(secondPageResponse.status, 200);
  const secondPage = await secondPageResponse.json() as {
    data: { items: Array<{ id: string }> };
  };
  assert.equal(secondPage.data.items.length, 1);
  assert.notEqual(secondPage.data.items[0]?.id, firstItem.id);
  assert.deepEqual(
    new Set([firstItem.id, secondPage.data.items[0]?.id]),
    new Set([createdIncidentId, secondIncidentId]),
  );

  const nearbyResponse = await request(
    `/incidents/nearby?latitude=6.9271&longitude=79.8612&radiusMeters=5000&limit=20&categoryId=${categoryId}`,
    otherToken,
  );
  assert.equal(nearbyResponse.status, 200);
  const nearby = await nearbyResponse.json() as {
    data: { items: Array<{ id: string }> };
  };
  assert.ok(nearby.data.items.some((item) => item.id === createdIncidentId));
  assert.ok(nearby.data.items.some((item) => item.id === secondIncidentId));
  const publicMetrics = spatialMetrics.filter((metric) => metric.operation === "incidents.public");
  assert.ok(publicMetrics.some((metric) => metric.mode === "VIEWPORT"));
  assert.ok(publicMetrics.some((metric) => metric.mode === "RADIUS"));
  assert.ok(publicMetrics.every(
    (metric) => metric.durationMs >= 0 && metric.resultCount <= MAP_LIMITS.maxPageSize + 1,
  ));

  const filteredResponse = await request(
    `/incidents?west=79.8&south=6.8&east=80&north=7.1&zoom=12&status=RESOLVED&categoryId=${categoryId}`,
    otherToken,
  );
  assert.equal(filteredResponse.status, 200);
  const filtered = await filteredResponse.json() as {
    data: { items: unknown[] };
  };
  assert.deepEqual(filtered.data.items, []);

  await prisma.incident.update({
    where: { id: secondIncidentId },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  const activeDefault = await request(
    `/incidents?west=79.8&south=6.8&east=80&north=7.1&zoom=12&categoryId=${categoryId}`,
    otherToken,
  );
  const activeDefaultItems = (await activeDefault.json() as {
    data: { items: Array<{ id: string }> };
  }).data.items;
  assert.equal(activeDefaultItems.some(({ id }) => id === secondIncidentId), false);
  const explicitResolved = await request(
    `/incidents?west=79.8&south=6.8&east=80&north=7.1&zoom=12&status=RESOLVED&categoryId=${categoryId}`,
    otherToken,
  );
  assert.equal((await explicitResolved.json()).data.items.some(
    (item: { id: string }) => item.id === secondIncidentId,
  ), true);

  const outsideResponse = await request(
    "/incidents?west=80.5&south=7.5&east=80.6&north=7.6&zoom=12",
    otherToken,
  );
  assert.equal(outsideResponse.status, 200);
  const outside = await outsideResponse.json() as {
    data: { items: unknown[] };
  };
  assert.deepEqual(outside.data.items, []);

  assert.equal(
    (await request("/incidents?scope=all", otherToken)).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/incidents?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=101",
        otherToken,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/incidents/nearby?latitude=6.9271&longitude=79.8612&radiusMeters=50001",
        otherToken,
      )
    ).status,
    400,
  );
});

test("organization discovery includes covered boundary incidents and active area outlines", async () => {
  const query = "west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=20";
  const response = await request(
    `/organizations/${organizationId}/incidents?${query}`,
    otherToken,
  );
  assert.equal(response.status, 200);
  const body = await response.json() as {
    data: { items: Array<Record<string, unknown>>; nextCursor: string | null };
  };
  const incident = body.data.items.find((item) => item.id === createdIncidentId);
  assert.ok(incident);
  assert.equal(
    body.data.items.filter((item) => item.id === createdIncidentId).length,
    1,
  );
  assert.equal("reporterUserId" in incident, false);
  assert.equal("description" in incident, false);
  assert.equal("privateNotes" in incident, false);
  assert.equal(incident.falseReviewCount, 0);
  assertProjectionExcludesPrivateFields(body.data, ORGANIZATION_LIST_FORBIDDEN_FIELDS);

  const allCoveredResponse = await request(
    `/organizations/${organizationId}/incidents?scope=all`,
    otherToken,
  );
  assert.equal(allCoveredResponse.status, 400);

  const boundaries = await request(
    `/organizations/${organizationId}/service-area-boundaries?west=79.8&south=6.8&east=80&north=7.1&zoom=12&limit=1`,
    otherToken,
  );
  assert.equal(boundaries.status, 200);
  const boundaryBody = await boundaries.json() as {
    data: {
      type: string;
      features: Array<{ properties: { id: string } }>;
      truncated: boolean;
    };
  };
  assert.equal(boundaryBody.data.type, "FeatureCollection");
  assert.equal(boundaryBody.data.features.length, 1);
  assert.equal(boundaryBody.data.features[0]?.properties.id, serviceAreaId);
  assert.equal(boundaryBody.data.truncated, true);

  const outsideBoundaries = await request(
    `/organizations/${organizationId}/service-area-boundaries?west=80.5&south=7.5&east=80.6&north=7.6&zoom=12`,
    otherToken,
  );
  assert.equal(outsideBoundaries.status, 200);
  assert.deepEqual(
    (await outsideBoundaries.json() as { data: { features: unknown[] } }).data.features,
    [],
  );

  assert.equal(
    (
      await request(
        `/organizations/${organizationId}/service-area-boundaries`,
        otherToken,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        `/organizations/${organizationId}/service-area-boundaries?west=79.4&south=5.8&east=82.1&north=10&zoom=7`,
        otherToken,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        `/organizations/${organizationId}/service-area-boundaries?${query}`,
        organizationBToken,
      )
    ).status,
    403,
  );

  const crossTenant = await request(
    `/organizations/${organizationId}/incidents?${query}`,
    reporterToken,
  );
  assert.equal(crossTenant.status, 403);

  const excessiveBounds = await request(
    `/organizations/${organizationId}/incidents?west=79.4&south=5.8&east=82.1&north=10&zoom=7`,
    otherToken,
  );
  assert.equal(excessiveBounds.status, 400);

  await prisma.organizationServiceArea.updateMany({
    where: { organizationId },
    data: { status: "INACTIVE" },
  });
  const inactiveAreaResponse = await request(
    `/organizations/${organizationId}/incidents?${query}`,
    otherToken,
  );
  const inactiveAreaBody = await inactiveAreaResponse.json() as {
    data: { items: unknown[] };
  };
  assert.equal(inactiveAreaResponse.status, 200);
  assert.deepEqual(inactiveAreaBody.data.items, []);
  await prisma.organizationServiceArea.updateMany({
    where: { organizationId },
    data: { status: "ACTIVE" },
  });
});

test("two-organization discovery preserves tenant-safe spatial and historical access", async () => {
  const overlapIncidentId = await createSpatialIncident({
    title: "Two organization overlap incident",
    latitude: 6.96,
    longitude: 79.92,
    categoryId: alternateCategoryId,
  });
  const organizationBOnlyIncidentId = await createSpatialIncident({
    title: "Organization B only incident",
    latitude: 6.96,
    longitude: 79.98,
  });
  const boundaryIncidentId = await createSpatialIncident({
    title: "Organization B boundary incident",
    latitude: 6.97,
    longitude: 79.90,
  });
  const outsideIncidentId = await createSpatialIncident({
    title: "Outside active service areas incident",
    latitude: 7.07,
    longitude: 80.08,
  });

  await prisma.incident.update({
    where: { id: organizationBOnlyIncidentId },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  await prisma.incident.update({
    where: { id: outsideIncidentId },
    data: { reportedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });

  // Keep these rows inside one JavaScript millisecond while retaining distinct
  // PostgreSQL microseconds. Keyset pagination must not lose any row when an
  // opaque cursor makes a round trip through the API.
  await prisma.$executeRaw`
    UPDATE "incidents"
    SET "reported_at" =
      date_trunc('second', NOW()) - INTERVAL '1 hour' +
      CASE "id"
        WHEN ${overlapIncidentId}::uuid THEN INTERVAL '900 microseconds'
        WHEN ${organizationBOnlyIncidentId}::uuid THEN INTERVAL '800 microseconds'
        WHEN ${boundaryIncidentId}::uuid THEN INTERVAL '700 microseconds'
        ELSE INTERVAL '0 microseconds'
      END
    WHERE "id" IN (
      ${overlapIncidentId}::uuid,
      ${organizationBOnlyIncidentId}::uuid,
      ${boundaryIncidentId}::uuid
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "administrative_areas" (
      "id", "official_code", "name_en", "boundary", "source_name",
      "is_active", "imported_at", "updated_at"
    ) VALUES (
      ${inactiveAdministrativeAreaId}::uuid,
      ${`INACTIVE-${inactiveAdministrativeAreaId}`},
      'Inactive spatial acceptance area',
      extensions.ST_GeogFromText(
        'MULTIPOLYGON(((80.04 7.04, 80.12 7.04, 80.12 7.10, 80.04 7.10, 80.04 7.04)))'
      ),
      'INC-02 integration test', false, NOW(), NOW()
    )
  `;
  await prisma.organizationServiceArea.create({
    data: {
      id: inactiveAdministrativeServiceAreaId,
      organizationId,
      administrativeAreaId: inactiveAdministrativeAreaId,
      status: "ACTIVE",
    },
  });

  const query = "west=79.8&south=6.85&east=80.15&north=7.12&zoom=12&limit=50";
  const organizationAResponse = await request(
    `/organizations/${organizationId}/incidents?${query}`,
    otherToken,
  );
  assert.equal(organizationAResponse.status, 200);
  const organizationAItems = (
    await organizationAResponse.json() as {
      data: { items: Array<Record<string, unknown> & { id: string }> };
    }
  ).data.items;
  assert.equal(organizationAItems.some(({ id }) => id === overlapIncidentId), true);
  assert.equal(organizationAItems.some(({ id }) => id === boundaryIncidentId), true);
  assert.equal(organizationAItems.some(({ id }) => id === organizationBOnlyIncidentId), false);
  assert.equal(organizationAItems.some(({ id }) => id === outsideIncidentId), false);
  assert.equal(
    organizationAItems.filter(({ id }) => id === overlapIncidentId).length,
    1,
  );

  const organizationBResponse = await request(
    `/organizations/${organizationBId}/incidents?${query}`,
    organizationBToken,
  );
  assert.equal(organizationBResponse.status, 200);
  const organizationBItems = (
    await organizationBResponse.json() as {
      data: { items: Array<{ id: string }> };
    }
  ).data.items;
  assert.equal(organizationBItems.some(({ id }) => id === overlapIncidentId), true);
  assert.equal(organizationBItems.some(({ id }) => id === organizationBOnlyIncidentId), true);
  assert.equal(organizationBItems.some(({ id }) => id === boundaryIncidentId), true);
  assert.equal(organizationBItems.some(({ id }) => id === createdIncidentId), false);
  assert.equal(organizationBItems.some(({ id }) => id === outsideIncidentId), false);
  assert.equal(
    organizationBItems.filter(({ id }) => id === overlapIncidentId).length,
    1,
  );

  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/incidents?${query}`,
        otherToken,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/organizations/${organizationId}/incidents?${query}`,
        organizationBToken,
      )
    ).status,
    403,
  );

  const alternateCategoryResponse = await request(
    `/organizations/${organizationId}/incidents?${query}&categoryId=${alternateCategoryId}`,
    otherToken,
  );
  const alternateItems = (
    await alternateCategoryResponse.json() as {
      data: { items: Array<{ id: string }> };
    }
  ).data.items;
  assert.deepEqual(alternateItems.map(({ id }) => id), [overlapIncidentId]);

  const resolvedResponse = await request(
    `/organizations/${organizationBId}/incidents?${query}&status=RESOLVED&categoryId=${categoryId}`,
    organizationBToken,
  );
  const resolvedItems = (
    await resolvedResponse.json() as {
      data: { items: Array<{ id: string }> };
    }
  ).data.items;
  assert.deepEqual(resolvedItems.map(({ id }) => id), [organizationBOnlyIncidentId]);

  const recentResponse = await request(
    `/incidents?${query}&reportedAfter=${encodeURIComponent(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())}`,
    reporterToken,
  );
  const recentItems = (
    await recentResponse.json() as {
      data: { items: Array<{ id: string }> };
    }
  ).data.items;
  assert.equal(recentItems.some(({ id }) => id === outsideIncidentId), false);

  const pagedIds: string[] = [];
  let cursor: string | null = null;
  do {
    const pageResponse = await request(
      `/organizations/${organizationBId}/incidents?west=79.8&south=6.85&east=80.15&north=7.12&zoom=12&limit=1&categoryId=${categoryId}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      organizationBToken,
    );
    assert.equal(pageResponse.status, 200);
    const page = (
      await pageResponse.json() as {
        data: { items: Array<{ id: string }>; nextCursor: string | null };
      }
    ).data;
    pagedIds.push(...page.items.map(({ id }) => id));
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(new Set(pagedIds).size, pagedIds.length);
  assert.deepEqual(
    new Set(pagedIds),
    new Set([organizationBOnlyIncidentId, boundaryIncidentId]),
  );

  await prisma.incidentReview.createMany({
    data: [
      {
        incidentId: overlapIncidentId,
        organizationId,
        status: "FALSE",
        privateNotes: "Organization A private overlap note",
        reviewedByMembershipId: organizationMembershipId,
        reviewedAt: new Date(),
      },
      {
        incidentId: overlapIncidentId,
        organizationId: organizationBId,
        status: "FALSE",
        privateNotes: "Organization B private overlap note",
        reviewedByMembershipId: organizationBMembershipId,
        reviewedAt: new Date(),
      },
      {
        incidentId: outsideIncidentId,
        organizationId,
        status: "VALID",
        privateNotes: "Retained organization A private note",
        reviewedByMembershipId: organizationMembershipId,
        reviewedAt: new Date(),
      },
    ],
  });
  await prisma.cleanupEvent.create({
    data: {
      organizationId,
      incidentId: organizationBOnlyIncidentId,
      currentWorkflowStatusId: organizationAWorkflowStatusId,
      lifecycleStatus: "DRAFT",
      createdByMembershipId: organizationMembershipId,
      title: "Retained organization A cleanup event",
      description: "A linked event preserves organization incident access.",
      eventLatitude: 6.96,
      eventLongitude: 79.98,
    },
  });

  const publicOverlapResponse = await request(
    `/incidents?${query}&categoryId=${alternateCategoryId}`,
    reporterToken,
  );
  const publicOverlap = (
    await publicOverlapResponse.json() as {
      data: { items: Array<Record<string, unknown> & { id: string }> };
    }
  ).data.items.find(({ id }) => id === overlapIncidentId);
  assert.ok(publicOverlap);
  assert.equal(publicOverlap.falseReviewCount, 2);
  assert.equal("currentReviewStatus" in publicOverlap, false);
  assert.equal("privateNotes" in publicOverlap, false);
  assertProjectionExcludesPrivateFields(publicOverlap);

  const organizationAOverlapDetail = await request(
    `/organizations/${organizationId}/incidents/${overlapIncidentId}`,
    otherToken,
  );
  assert.equal(organizationAOverlapDetail.status, 200);
  const organizationAOverlapReview = (
    await organizationAOverlapDetail.json() as {
      data: { currentReview: { privateNotes: string } };
    }
  ).data.currentReview;
  assert.equal(organizationAOverlapReview.privateNotes, "Organization A private overlap note");

  const organizationBOverlapDetail = await request(
    `/organizations/${organizationBId}/incidents/${overlapIncidentId}`,
    organizationBToken,
  );
  assert.equal(organizationBOverlapDetail.status, 200);
  const organizationBOverlapReview = (
    await organizationBOverlapDetail.json() as {
      data: { currentReview: { privateNotes: string } };
    }
  ).data.currentReview;
  assert.equal(organizationBOverlapReview.privateNotes, "Organization B private overlap note");
  assert.equal(
    (
      await request(
        `/organizations/${organizationId}/incidents/${overlapIncidentId}`,
        organizationBToken,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/organizations/${organizationId}/incidents/${overlapIncidentId}/review`,
        organizationBToken,
        { method: "PATCH", body: JSON.stringify({ status: "VALID" }) },
      )
    ).status,
    403,
  );

  await prisma.organizationServiceArea.updateMany({
    where: { organizationId },
    data: { status: "INACTIVE" },
  });
  const retainedResponse = await request(
    `/organizations/${organizationId}/incidents?${query}`,
    otherToken,
  );
  const retainedItems = (
    await retainedResponse.json() as {
      data: { items: Array<Record<string, unknown> & { id: string }> };
    }
  ).data.items;
  assert.deepEqual(
    new Set(retainedItems.map(({ id }) => id)),
    new Set([overlapIncidentId, organizationBOnlyIncidentId, outsideIncidentId]),
  );
  const retainedReview = retainedItems.find(({ id }) => id === outsideIncidentId);
  assert.equal(retainedReview?.currentReviewStatus, "VALID");
  assert.equal("privateNotes" in (retainedReview ?? {}), false);

  await prisma.organization.update({
    where: { id: organizationBId },
    data: { status: "SUSPENDED" },
  });
  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/incidents?${query}`,
        organizationBToken,
      )
    ).status,
    403,
  );
  await prisma.organization.update({
    where: { id: organizationBId },
    data: { status: "ACTIVE" },
  });
  await prisma.organizationServiceArea.updateMany({
    where: { organizationId },
    data: { status: "ACTIVE" },
  });
});

test("organization review detail and mutation remain tenant-private and idempotent", async () => {
  const detailResponse = await request(
    `/organizations/${organizationId}/incidents/${createdIncidentId}`,
    otherToken,
  );
  assert.equal(detailResponse.status, 200);
  const initialDetail = (
    await detailResponse.json() as {
      data: Record<string, unknown> & {
        accessSource: string;
        currentReview: unknown;
      };
    }
  ).data;
  assert.equal(initialDetail.accessSource, "CURRENT_SERVICE_AREA");
  assert.equal(initialDetail.currentReview, null);
  assert.equal("reporterUserId" in initialDetail, false);
  assert.equal("email" in initialDetail, false);
  assert.equal("phoneNumber" in initialDetail, false);

  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/incidents/${createdIncidentId}`,
        organizationBToken,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/incidents/${createdIncidentId}/review`,
        organizationBToken,
        { method: "PATCH", body: JSON.stringify({ status: "VALID" }) },
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        `/organizations/${organizationId}/incidents/${createdIncidentId}/review`,
        reporterToken,
        { method: "PATCH", body: JSON.stringify({ status: "VALID" }) },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/organizations/${organizationId}/incidents/${createdIncidentId}`,
        organizationMemberToken,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/organizations/${organizationId}/incidents/${createdIncidentId}/review`,
        organizationMemberToken,
        { method: "PATCH", body: JSON.stringify({ status: "VALID" }) },
      )
    ).status,
    403,
  );

  const invalidFalse = await request(
    `/organizations/${organizationId}/incidents/${createdIncidentId}/review`,
    otherToken,
    { method: "PATCH", body: JSON.stringify({ status: "FALSE" }) },
  );
  assert.equal(invalidFalse.status, 400);

  const viewedResponse = await request(
    `/organizations/${organizationId}/incidents/${createdIncidentId}/review`,
    otherToken,
    { method: "PATCH", body: JSON.stringify({ status: "VIEWED" }) },
  );
  assert.equal(viewedResponse.status, 200);
  const viewed = (
    await viewedResponse.json() as { data: { review: { id: string; status: string } } }
  ).data.review;
  assert.equal(viewed.status, "VIEWED");

  const privateNote = "Internal verification note that must never reach the reporter.";
  const falseResponse = await request(
    `/organizations/${organizationId}/incidents/${createdIncidentId}/review`,
    otherToken,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "FALSE",
        reasonCode: "INSUFFICIENT_EVIDENCE",
        privateNotes: privateNote,
      }),
    },
  );
  assert.equal(falseResponse.status, 200);
  const falseReview = (
    await falseResponse.json() as {
      data: { review: { id: string; status: string; privateNotes: string } };
    }
  ).data.review;
  assert.equal(falseReview.id, viewed.id);
  assert.equal(falseReview.status, "FALSE");
  assert.equal(falseReview.privateNotes, privateNote);

  const invalidTransition = await request(
    `/organizations/${organizationId}/incidents/${createdIncidentId}/review`,
    otherToken,
    { method: "PATCH", body: JSON.stringify({ status: "VIEWED" }) },
  );
  assert.equal(invalidTransition.status, 409);

  const validBody = {
    status: "VALID",
    privateNotes: "Validated after the organization inspected the evidence.",
  };
  const validResponse = await request(
    `/organizations/${organizationId}/incidents/${createdIncidentId}/review`,
    otherToken,
    { method: "PATCH", body: JSON.stringify(validBody) },
  );
  assert.equal(validResponse.status, 200);
  const validResult = (
    await validResponse.json() as {
      data: {
        review: { id: string; status: string };
        rewardAwarded: boolean;
        idempotentReplay: boolean;
      };
    }
  ).data;
  assert.equal(validResult.review.id, viewed.id);
  assert.equal(validResult.review.status, "VALID");
  assert.equal(validResult.rewardAwarded, true);
  assert.equal(validResult.idempotentReplay, false);

  const replayResponse = await request(
    `/organizations/${organizationId}/incidents/${createdIncidentId}/review`,
    otherToken,
    { method: "PATCH", body: JSON.stringify(validBody) },
  );
  assert.equal(replayResponse.status, 200);
  const replay = (
    await replayResponse.json() as {
      data: { rewardAwarded: boolean; idempotentReplay: boolean };
    }
  ).data;
  assert.equal(replay.rewardAwarded, false);
  assert.equal(replay.idempotentReplay, true);

  assert.equal(
    await prisma.incidentReview.count({
      where: { incidentId: createdIncidentId, organizationId },
    }),
    1,
  );
  assert.equal(
    await prisma.contributionEvent.count({
      where: {
        incidentId: createdIncidentId,
        type: "VERIFIED_INCIDENT_REPORT",
      },
    }),
    1,
  );
  assert.equal(
    (await prisma.incident.findUniqueOrThrow({
      where: { id: createdIncidentId },
      select: { status: true },
    })).status,
    "ACTIVE",
  );

  const reporterNotifications = await prisma.notification.findMany({
    where: {
      userId: reporterId,
      data: { path: ["incidentId"], equals: createdIncidentId },
    },
    select: { message: true, data: true },
  });
  assert.equal(reporterNotifications.length, 2);
  for (const notification of reporterNotifications) {
    assert.equal(notification.message.includes(privateNote), false);
    assert.equal(JSON.stringify(notification.data).includes(privateNote), false);
  }
});

test("full incident handoff keeps overlap reviews independent and publication idempotent", async () => {
  const workflowSubmissionId = randomUUID();
  const createBody = {
    submissionId: workflowSubmissionId,
    categoryId,
    title: "INC-04 overlapping cleanup workflow",
    description: "A shared incident used to verify the complete report, review, and publish handoff.",
    severity: "HIGH",
    latitude: 6.96,
    longitude: 79.92,
    addressText: "Overlapping organization boundary",
    evidence: [],
  };

  const createResponse = await request("/incidents", reporterToken, {
    method: "POST",
    body: JSON.stringify(createBody),
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json() as {
    data: {
      id: string;
      status: string;
      statusHistory: Array<{ toStatus: string }>;
    };
  }).data;
  assert.equal(created.status, "ACTIVE");
  assert.deepEqual(created.statusHistory.map(({ toStatus }) => toStatus), ["ACTIVE"]);

  const createReplay = await request("/incidents", reporterToken, {
    method: "POST",
    body: JSON.stringify(createBody),
  });
  assert.equal(createReplay.status, 200);
  assert.equal((await createReplay.json()).data.id, created.id);
  assert.equal(
    await prisma.incident.count({
      where: { reporterUserId: reporterId, submissionId: workflowSubmissionId },
    }),
    1,
  );
  assert.equal(
    await prisma.incidentStatusHistory.count({ where: { incidentId: created.id } }),
    1,
  );

  for (const [organization, token] of [
    [organizationId, otherToken],
    [organizationBId, organizationBToken],
  ] as const) {
    const detailResponse = await request(
      `/organizations/${organization}/incidents/${created.id}`,
      token,
    );
    assert.equal(detailResponse.status, 200);
    assert.equal((await detailResponse.json()).data.id, created.id);
  }

  const organizationAFalse = await request(
    `/organizations/${organizationId}/incidents/${created.id}/review`,
    otherToken,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "FALSE",
        reasonCode: "INSUFFICIENT_EVIDENCE",
        privateNotes: "Organization A private INC-04 verification note.",
      }),
    },
  );
  assert.equal(organizationAFalse.status, 200);

  const organizationBFalse = await request(
    `/organizations/${organizationBId}/incidents/${created.id}/review`,
    organizationBToken,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "FALSE",
        reasonCode: "LOCATION_INCORRECT",
        privateNotes: "Organization B private INC-04 verification note.",
      }),
    },
  );
  assert.equal(organizationBFalse.status, 200);
  const organizationBFalseReview = (await organizationBFalse.json()).data.review as {
    id: string;
  };

  const discoveryPath =
    `/incidents?west=79.8&south=6.85&east=80.05&north=7.1&zoom=12&limit=50`;
  const falseDiscovery = await request(discoveryPath, reporterToken);
  assert.equal(falseDiscovery.status, 200);
  const falseSummary = (await falseDiscovery.json() as {
    data: { items: Array<Record<string, unknown> & { id: string }> };
  }).data.items.find(({ id }) => id === created.id);
  assert.ok(falseSummary);
  assert.equal(falseSummary.falseReviewCount, 2);
  assert.equal(
    (await prisma.incident.findUniqueOrThrow({ where: { id: created.id } })).status,
    "ACTIVE",
  );

  const organizationBValidBody = {
    status: "VALID",
    privateNotes: "Organization B validated the report after a site inspection.",
  };
  const organizationBValid = await request(
    `/organizations/${organizationBId}/incidents/${created.id}/review`,
    organizationBToken,
    { method: "PATCH", body: JSON.stringify(organizationBValidBody) },
  );
  assert.equal(organizationBValid.status, 200);
  const validMutation = (await organizationBValid.json()).data as {
    review: { id: string; status: string };
    rewardAwarded: boolean;
    idempotentReplay: boolean;
  };
  assert.equal(validMutation.review.id, organizationBFalseReview.id);
  assert.equal(validMutation.review.status, "VALID");
  assert.equal(validMutation.rewardAwarded, true);
  assert.equal(validMutation.idempotentReplay, false);

  const validReplay = await request(
    `/organizations/${organizationBId}/incidents/${created.id}/review`,
    organizationBToken,
    { method: "PATCH", body: JSON.stringify(organizationBValidBody) },
  );
  assert.equal(validReplay.status, 200);
  assert.equal((await validReplay.json()).data.idempotentReplay, true);
  assert.equal(
    await prisma.incidentReview.count({ where: { incidentId: created.id } }),
    2,
  );
  assert.equal(
    await prisma.contributionEvent.count({
      where: { incidentId: created.id, type: "VERIFIED_INCIDENT_REPORT" },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: {
        userId: reporterId,
        type: "INCIDENT_STATUS_CHANGED",
        data: { path: ["incidentId"], equals: created.id },
      },
    }),
    3,
  );

  const updatedDiscovery = await request(discoveryPath, reporterToken);
  const updatedSummary = (await updatedDiscovery.json() as {
    data: { items: Array<Record<string, unknown> & { id: string }> };
  }).data.items.find(({ id }) => id === created.id);
  assert.ok(updatedSummary);
  assert.equal(updatedSummary.falseReviewCount, 1);

  const organizationADetail = await request(
    `/organizations/${organizationId}/incidents/${created.id}`,
    otherToken,
  );
  const organizationBDetail = await request(
    `/organizations/${organizationBId}/incidents/${created.id}`,
    organizationBToken,
  );
  assert.equal(
    (await organizationADetail.json()).data.currentReview.privateNotes,
    "Organization A private INC-04 verification note.",
  );
  assert.equal(
    (await organizationBDetail.json()).data.currentReview.privateNotes,
    organizationBValidBody.privateNotes,
  );
  assert.equal(
    (
      await request(
        `/organizations/${organizationId}/incidents/${created.id}`,
        organizationBToken,
      )
    ).status,
    403,
  );

  const draftResponse = await request(
    `/organizations/${organizationBId}/events/drafts`,
    organizationBToken,
    {
      method: "POST",
      body: JSON.stringify({
        incidentId: created.id,
        title: "INC-04 linked cleanup event",
        description: "A linked cleanup event created after an independent VALID review.",
        eventLatitude: 6.96,
        eventLongitude: 79.92,
      }),
    },
  );
  assert.equal(draftResponse.status, 201);
  const eventId = (await draftResponse.json()).data.id as string;

  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/events/drafts/${eventId}`,
        organizationBToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            publicInstructions: "Wear closed shoes and bring drinking water.",
            eventAddress: "INC-04 community meeting point",
          }),
        },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/events/${eventId}/sessions`,
        organizationBToken,
        {
          method: "POST",
          body: JSON.stringify({
            sessionDate: "2099-10-01",
            startTime: "09:00:00",
            endTime: "12:00:00",
            capacity: 25,
          }),
        },
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/events/${eventId}/coordinators`,
        organizationBToken,
        {
          method: "POST",
          body: JSON.stringify({ membershipId: organizationBMembershipId }),
        },
      )
    ).status,
    201,
  );

  const publishPath = `/organizations/${organizationBId}/events/${eventId}/publish`;
  const published = await request(publishPath, organizationBToken, { method: "POST" });
  assert.equal(published.status, 200);
  const publishedBody = (await published.json()).data as {
    incidentUpdated: boolean;
    event: { sessions: Array<{ id: string }> };
  };
  assert.equal(publishedBody.incidentUpdated, true);
  const firstSessionId = publishedBody.event.sessions[0]?.id;
  assert.ok(firstSessionId);
  const publishReplay = await request(publishPath, organizationBToken, { method: "POST" });
  assert.equal(publishReplay.status, 200);

  const storedIncident = await prisma.incident.findUniqueOrThrow({
    where: { id: created.id },
  });
  assert.equal(storedIncident.status, "CLEANUP_ORGANIZED");
  assert.equal(
    await prisma.incidentStatusHistory.count({
      where: {
        incidentId: created.id,
        relatedCleanupEventId: eventId,
        toStatus: "CLEANUP_ORGANIZED",
      },
    }),
    1,
  );
  assert.equal(
    await prisma.eventStatusHistory.count({ where: { cleanupEventId: eventId } }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: {
        userId: reporterId,
        type: "EVENT_PUBLISHED",
        data: { path: ["eventId"], equals: eventId },
      },
    }),
    1,
  );

  // A joined volunteer receives the cancellation once. Cancellation releases
  // the incident claim, allowing the same validating organization to publish
  // a replacement event without changing its private review.
  assert.equal(
    (
      await request(`/events/${eventId}/participation`, reporterToken, {
        method: "POST",
        body: JSON.stringify({ sessionIds: [firstSessionId] }),
      })
    ).status,
    201,
  );
  const initialOperations = (await (
    await request(
      `/organizations/${organizationBId}/events/${eventId}/operations`,
      organizationBToken,
    )
  ).json()).data as { event: { updatedAt: string } };
  const cancellationBody = {
    expectedUpdatedAt: initialOperations.event.updatedAt,
    reason: "Unsafe weather conditions require this cleanup event to be replaced.",
  };
  const cancellation = await request(
    `/organizations/${organizationBId}/events/${eventId}/cancel`,
    organizationBToken,
    { method: "POST", body: JSON.stringify(cancellationBody) },
  );
  assert.equal(cancellation.status, 200);
  assert.equal((await cancellation.json()).data.incidentStatus, "ACTIVE");

  const cancellationReplay = await request(
    `/organizations/${organizationBId}/events/${eventId}/cancel`,
    organizationBToken,
    { method: "POST", body: JSON.stringify(cancellationBody) },
  );
  assert.equal(cancellationReplay.status, 200);
  assert.equal((await cancellationReplay.json()).data.idempotentReplay, true);
  assert.equal(
    await prisma.incidentStatusHistory.count({
      where: {
        incidentId: created.id,
        relatedCleanupEventId: eventId,
        fromStatus: "CLEANUP_ORGANIZED",
        toStatus: "ACTIVE",
      },
    }),
    1,
  );
  assert.equal(
    await prisma.eventStatusHistory.count({
      where: { cleanupEventId: eventId, toStatus: { mappedLifecycleStatus: "CANCELLED" } },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: {
        userId: reporterId,
        type: "EVENT_CANCELLED",
        data: { path: ["eventId"], equals: eventId },
      },
    }),
    1,
  );
  assert.equal(
    await prisma.cleanupEvent.count({
      where: {
        incidentId: created.id,
        lifecycleStatus: { in: ["PUBLISHED", "SCHEDULED", "IN_PROGRESS", "COMPLETION_SUBMITTED"] },
      },
    }),
    0,
  );

  const replacementDraft = await request(
    `/organizations/${organizationBId}/events/drafts`,
    organizationBToken,
    {
      method: "POST",
      body: JSON.stringify({
        incidentId: created.id,
        title: "INC-04 replacement cleanup event",
        description: "The replacement event completes the incident regression lifecycle.",
        eventLatitude: 6.96,
        eventLongitude: 79.92,
      }),
    },
  );
  assert.equal(replacementDraft.status, 201);
  const replacementEventId = (await replacementDraft.json()).data.id as string;
  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/events/drafts/${replacementEventId}`,
        organizationBToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            publicInstructions: "Wear closed shoes and follow coordinator instructions.",
            eventAddress: "INC-04 replacement meeting point",
          }),
        },
      )
    ).status,
    200,
  );
  const replacementSessionResponse = await request(
    `/organizations/${organizationBId}/events/${replacementEventId}/sessions`,
    organizationBToken,
    {
      method: "POST",
      body: JSON.stringify({
        sessionDate: "2099-10-02",
        startTime: "09:00:00",
        endTime: "12:00:00",
        capacity: 25,
      }),
    },
  );
  assert.equal(replacementSessionResponse.status, 201);
  const replacementSessionId = (await replacementSessionResponse.json()).data.id as string;
  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/events/${replacementEventId}/coordinators`,
        organizationBToken,
        {
          method: "POST",
          body: JSON.stringify({ membershipId: organizationBMembershipId }),
        },
      )
    ).status,
    201,
  );
  const replacementPublishPath =
    `/organizations/${organizationBId}/events/${replacementEventId}/publish`;
  assert.equal(
    (await request(replacementPublishPath, organizationBToken, { method: "POST" })).status,
    200,
  );
  assert.equal(
    (
      await request(`/events/${replacementEventId}/participation`, reporterToken, {
        method: "POST",
        body: JSON.stringify({ sessionIds: [replacementSessionId] }),
      })
    ).status,
    201,
  );
  const participant = await prisma.eventParticipant.findFirstOrThrow({
    where: { cleanupEventId: replacementEventId, userId: reporterId },
  });
  const allocationResponse = await request(
    `/organizations/${organizationBId}/events/${replacementEventId}/allocations`,
    organizationBToken,
    {
      method: "POST",
      body: JSON.stringify({
        participantId: participant.id,
        sessionId: replacementSessionId,
      }),
    },
  );
  assert.equal(allocationResponse.status, 201);
  const allocationId = (await allocationResponse.json()).data.id as string;

  await prisma.eventSession.update({
    where: { id: replacementSessionId },
    data: {
      sessionDate: new Date("2020-01-01T00:00:00.000Z"),
      startTime: new Date("1970-01-01T09:00:00.000Z"),
    },
  });
  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/events/${replacementEventId}/allocations/${allocationId}/attendance`,
        organizationBToken,
        { method: "PATCH", body: JSON.stringify({ status: "ATTENDED" }) },
      )
    ).status,
    200,
  );

  const evidenceIntent = await request(
    `/organizations/${organizationBId}/events/${replacementEventId}/evidence/upload-intents`,
    organizationBToken,
    {
      method: "POST",
      body: JSON.stringify({
        files: [{ originalFileName: "inc-04-after.jpg", contentType: "image/jpeg", sizeBytes: 2048 }],
      }),
    },
  );
  assert.equal(evidenceIntent.status, 201);
  const evidenceStoragePath = (await evidenceIntent.json()).data[0].storagePath as string;
  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/events/${replacementEventId}/evidence`,
        organizationBToken,
        {
          method: "POST",
          body: JSON.stringify({
            storagePath: evidenceStoragePath,
            originalFileName: "inc-04-after.jpg",
            contentType: "image/jpeg",
            sizeBytes: 2048,
            type: "AFTER",
            sessionId: replacementSessionId,
            caption: "The verified area after cleanup completion.",
          }),
        },
      )
    ).status,
    201,
  );

  let replacementOperations = (await (
    await request(
      `/organizations/${organizationBId}/events/${replacementEventId}/operations`,
      organizationBToken,
    )
  ).json()).data as {
    event: { updatedAt: string };
    sessions: Array<{ id: string; updatedAt: string }>;
    availableTransitions: Array<{ id: string; lifecycleStatus: string }>;
  };
  const inProgressTarget = replacementOperations.availableTransitions.find(
    ({ lifecycleStatus }) => lifecycleStatus === "IN_PROGRESS",
  );
  assert.ok(inProgressTarget);
  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/events/${replacementEventId}/transitions`,
        organizationBToken,
        {
          method: "POST",
          body: JSON.stringify({
            targetWorkflowStatusId: inProgressTarget.id,
            expectedUpdatedAt: replacementOperations.event.updatedAt,
          }),
        },
      )
    ).status,
    200,
  );
  let replacementSession = replacementOperations.sessions.find(
    ({ id }) => id === replacementSessionId,
  );
  assert.ok(replacementSession);
  const startedSession = await request(
    `/organizations/${organizationBId}/events/${replacementEventId}/sessions/${replacementSessionId}/status`,
    organizationBToken,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "IN_PROGRESS",
        expectedUpdatedAt: replacementSession.updatedAt,
      }),
    },
  );
  assert.equal(startedSession.status, 200);
  replacementSession = (await startedSession.json()).data as {
    id: string;
    updatedAt: string;
  };
  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/events/${replacementEventId}/sessions/${replacementSessionId}/status`,
        organizationBToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "COMPLETED",
            expectedUpdatedAt: replacementSession.updatedAt,
          }),
        },
      )
    ).status,
    200,
  );

  replacementOperations = (await (
    await request(
      `/organizations/${organizationBId}/events/${replacementEventId}/operations`,
      organizationBToken,
    )
  ).json()).data;
  const completionSubmittedTarget = replacementOperations.availableTransitions.find(
    ({ lifecycleStatus }) => lifecycleStatus === "COMPLETION_SUBMITTED",
  );
  assert.ok(completionSubmittedTarget);
  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/events/${replacementEventId}/transitions`,
        organizationBToken,
        {
          method: "POST",
          body: JSON.stringify({
            targetWorkflowStatusId: completionSubmittedTarget.id,
            expectedUpdatedAt: replacementOperations.event.updatedAt,
            notes: "The INC-04 cleanup work and evidence are ready for completion.",
          }),
        },
      )
    ).status,
    200,
  );
  const readiness = await request(
    `/organizations/${organizationBId}/events/${replacementEventId}/completion-readiness`,
    organizationBToken,
  );
  assert.equal(readiness.status, 200);
  assert.equal((await readiness.json()).data.ready, true);

  replacementOperations = (await (
    await request(
      `/organizations/${organizationBId}/events/${replacementEventId}/operations`,
      organizationBToken,
    )
  ).json()).data;
  const completionBody = {
    expectedUpdatedAt: replacementOperations.event.updatedAt,
    notes: "INC-04 completion evidence reviewed.",
  };
  const completion = await request(
    `/organizations/${organizationBId}/events/${replacementEventId}/complete`,
    organizationBToken,
    { method: "POST", body: JSON.stringify(completionBody) },
  );
  assert.equal(completion.status, 200);
  const completionResult = (await completion.json()).data as {
    lifecycleStatus: string;
    incidentStatus: string;
    rewardsAwarded: number;
  };
  assert.equal(completionResult.lifecycleStatus, "COMPLETED");
  assert.equal(completionResult.incidentStatus, "RESOLVED");
  assert.equal(completionResult.rewardsAwarded, 1);

  const completionReplay = await request(
    `/organizations/${organizationBId}/events/${replacementEventId}/complete`,
    organizationBToken,
    { method: "POST", body: JSON.stringify(completionBody) },
  );
  assert.equal(completionReplay.status, 200);
  assert.equal((await completionReplay.json()).data.idempotentReplay, true);
  assert.equal(
    await prisma.incidentStatusHistory.count({
      where: {
        incidentId: created.id,
        relatedCleanupEventId: replacementEventId,
        fromStatus: "CLEANUP_ORGANIZED",
        toStatus: "RESOLVED",
      },
    }),
    1,
  );
  assert.equal(
    await prisma.contributionEvent.count({
      where: { cleanupEventId: replacementEventId, type: "EVENT_COMPLETED" },
    }),
    1,
  );
  assert.equal(
    await prisma.auditLog.count({
      where: { action: "CLEANUP_EVENT_COMPLETED", entityId: replacementEventId },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: {
        userId: reporterId,
        type: "EVENT_COMPLETED",
        data: { path: ["eventId"], equals: replacementEventId },
      },
    }),
    1,
  );

  const ownDetail = await request(`/incidents/me/${created.id}`, reporterToken);
  assert.equal(ownDetail.status, 200);
  const ownIncident = (await ownDetail.json()).data as {
    status: string;
    statusHistory: Array<{ toStatus: string }>;
  };
  assert.equal(ownIncident.status, "RESOLVED");
  assert.deepEqual(
    ownIncident.statusHistory.map(({ toStatus }) => toStatus),
    ["ACTIVE", "CLEANUP_ORGANIZED", "ACTIVE", "CLEANUP_ORGANIZED", "RESOLVED"],
  );

  for (const token of [reporterToken, superAdminToken]) {
    const publicDetail = await request(`/incidents/${created.id}`, token);
    assert.equal(publicDetail.status, 200);
    assertProjectionExcludesPrivateFields((await publicDetail.json()).data);
  }
});

test("cancelling an elapsed linked event restores the incident from stored deadlines", async () => {
  const now = new Date();
  const elapsedIncident = await prisma.incident.create({
    data: {
      reporterUserId: reporterId,
      submissionId: randomUUID(),
      categoryId,
      title: "INC-04 elapsed cancellation incident",
      description: "An elapsed incident verifies deadline-aware claim release after cancellation.",
      severity: "MEDIUM",
      status: "CLEANUP_ORGANIZED",
      latitude: 6.96,
      longitude: 79.92,
      highlightUntil: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      archiveAfter: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      reportedAt: new Date(now.getTime() - 72 * 60 * 60 * 1000),
    },
  });
  await prisma.incidentReview.create({
    data: {
      incidentId: elapsedIncident.id,
      organizationId: organizationBId,
      status: "VALID",
      reviewedByMembershipId: organizationBMembershipId,
      reviewedAt: now,
    },
  });
  const publishedStatus = await prisma.cleanupWorkflowStatus.findFirstOrThrow({
    where: { organizationId: organizationBId, mappedLifecycleStatus: "PUBLISHED" },
  });
  const elapsedEvent = await prisma.cleanupEvent.create({
    data: {
      organizationId: organizationBId,
      incidentId: elapsedIncident.id,
      currentWorkflowStatusId: publishedStatus.id,
      lifecycleStatus: "PUBLISHED",
      createdByMembershipId: organizationBMembershipId,
      title: "INC-04 elapsed linked event",
      description: "This event is cancelled after the incident highlight deadline.",
      publicInstructions: "Follow the event coordinator's safety instructions.",
      eventLatitude: 6.96,
      eventLongitude: 79.92,
      publishedAt: now,
    },
  });
  const operations = await request(
    `/organizations/${organizationBId}/events/${elapsedEvent.id}/operations`,
    organizationBToken,
  );
  assert.equal(operations.status, 200);
  const expectedUpdatedAt = (await operations.json()).data.event.updatedAt as string;
  const cancelled = await request(
    `/organizations/${organizationBId}/events/${elapsedEvent.id}/cancel`,
    organizationBToken,
    {
      method: "POST",
      body: JSON.stringify({
        expectedUpdatedAt,
        reason: "The original cleanup schedule can no longer proceed safely.",
      }),
    },
  );
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).data.incidentStatus, "EXPIRED");
  const stored = await prisma.incident.findUniqueOrThrow({
    where: { id: elapsedIncident.id },
  });
  assert.equal(stored.status, "EXPIRED");
  assert.equal(stored.archivedAt, null);
  assert.equal(
    await prisma.incidentStatusHistory.count({
      where: {
        incidentId: elapsedIncident.id,
        relatedCleanupEventId: elapsedEvent.id,
        fromStatus: "CLEANUP_ORGANIZED",
        toStatus: "EXPIRED",
      },
    }),
    1,
  );
});

test("rejects invalid coordinates and inactive categories", async () => {
  const invalidCoordinates = await request("/incidents", reporterToken, {
    method: "POST",
    body: JSON.stringify({
      submissionId: randomUUID(), categoryId, title: "Invalid location",
      description: "This location is deliberately outside the supported region.",
      severity: "LOW", latitude: 51.5, longitude: -0.1, evidence: [],
    }),
  });
  assert.equal(invalidCoordinates.status, 400);

  await prisma.incidentCategory.update({ where: { id: categoryId }, data: { isActive: false } });
  const inactiveCategory = await request("/incidents", reporterToken, {
    method: "POST",
    body: JSON.stringify({
      submissionId: randomUUID(), categoryId, title: "Inactive category",
      description: "This report uses a category that has just been deactivated.",
      severity: "LOW", latitude: 6.9271, longitude: 79.8612, evidence: [],
    }),
  });
  assert.equal(inactiveCategory.status, 422);
});
