import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

import express from "express";

import { authorizationDependencies } from "../../authorization/authorization.dependencies.js";
import { prisma } from "../../database/prisma.js";
import {
  AccountStatus,
  PlatformRole,
} from "../../generated/prisma/enums.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import { createDashboardRouter } from "./dashboard.routes.js";

const citizenAId = randomUUID();
const citizenAAuthId = randomUUID();
const citizenBId = randomUUID();
const citizenBAuthId = randomUUID();
const superAdminId = randomUUID();
const superAdminAuthId = randomUUID();
const organizationAId = randomUUID();
const organizationBId = randomUUID();
const membershipAId = randomUUID();
const membershipBId = randomUUID();
const serviceAreaAId = randomUUID();
const serviceAreaBId = randomUUID();
const categoryId = randomUUID();
const incidentAId = randomUUID();
const incidentBId = randomUUID();
let workflowStatusAId = "";
let workflowStatusBId = "";
const eventAId = randomUUID();
const eventBId = randomUUID();

const citizenAToken = `dashboard-citizen-a-${citizenAId}`;
const citizenBToken = `dashboard-citizen-b-${citizenBId}`;
const superAdminToken = `dashboard-super-admin-${superAdminId}`;

const profiles = {
  [citizenAToken]: {
    id: citizenAId,
    authUserId: citizenAAuthId,
    email: `dashboard-a-${citizenAId}@example.com`,
    fullName: "Dashboard Citizen A",
    phoneNumber: "+94770000101",
    platformRole: PlatformRole.USER,
  },
  [citizenBToken]: {
    id: citizenBId,
    authUserId: citizenBAuthId,
    email: `dashboard-b-${citizenBId}@example.com`,
    fullName: "Dashboard Citizen B",
    phoneNumber: "+94770000102",
    platformRole: PlatformRole.USER,
  },
  [superAdminToken]: {
    id: superAdminId,
    authUserId: superAdminAuthId,
    email: `dashboard-super-${superAdminId}@example.com`,
    fullName: "Dashboard Super Admin",
    phoneNumber: "+94770000103",
    platformRole: PlatformRole.SUPER_ADMIN,
  },
};

const authenticationDependencies: AuthenticationDependencies = {
  async verifyAccessToken(token) {
    const profile = profiles[token as keyof typeof profiles];

    return profile
      ? {
          authUserId: profile.authUserId,
          email: profile.email,
        }
      : null;
  },
  async provisionOrSynchronizeProfile(identity) {
    const profile = Object.values(profiles).find(
      (candidate) => candidate.authUserId === identity.authUserId,
    );

    if (!profile) {
      throw new Error("Dashboard integration profile was not found.");
    }

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      phoneNumber: profile.phoneNumber,
      profileCompletedAt: new Date(),
      platformRole: profile.platformRole,
      accountStatus: AccountStatus.ACTIVE,
    };
  },
};

let server: Server | undefined;
let baseUrl = "";
let initialPlatformUserCount = 0;

function request(path: string, token: string) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

before(async () => {
  initialPlatformUserCount = await prisma.userProfile.count();

  await prisma.userProfile.createMany({
    data: Object.values(profiles).map((profile) => ({
      id: profile.id,
      authUserId: profile.authUserId,
      email: profile.email,
      fullName: profile.fullName,
      phoneNumber: profile.phoneNumber,
      profileCompletedAt: new Date(),
      platformRole: profile.platformRole,
    })),
  });

  await prisma.incidentCategory.create({
    data: {
      id: categoryId,
      name: `Dashboard category ${categoryId}`,
      isActive: true,
    },
  });

  await prisma.organization.create({
    data: {
      id: organizationAId,
      requestedByUserId: citizenAId,
      name: `Dashboard Organization A ${organizationAId}`,
      slug: `dashboard-a-${organizationAId}`,
      officialEmail: profiles[citizenAToken].email,
      officialPhone: "+94770000111",
      officialAddress: "Colombo, Sri Lanka",
      status: "ACTIVE",
      memberships: {
        create: {
          id: membershipAId,
          userId: citizenAId,
          role: "ORG_ADMIN",
          status: "ACTIVE",
          source: "FIRST_ADMIN",
        },
      },
    },
  });

  await prisma.organization.create({
    data: {
      id: organizationBId,
      requestedByUserId: citizenBId,
      name: `Dashboard Organization B ${organizationBId}`,
      slug: `dashboard-b-${organizationBId}`,
      officialEmail: profiles[citizenBToken].email,
      officialPhone: "+94770000112",
      officialAddress: "Galle, Sri Lanka",
      status: "ACTIVE",
      memberships: {
        create: {
          id: membershipBId,
          userId: citizenBId,
          role: "ORG_ADMIN",
          status: "ACTIVE",
          source: "FIRST_ADMIN",
        },
      },
    },
  });

  await prisma.$executeRaw`
    INSERT INTO "organization_service_areas" (
      "id", "organization_id", "area_name", "boundary", "status",
      "created_at", "updated_at"
    ) VALUES (
      ${serviceAreaAId}::uuid,
      ${organizationAId}::uuid,
      'Dashboard area A',
      extensions.ST_GeogFromText(
        'MULTIPOLYGON(((79.80 6.85, 79.92 6.85, 79.92 7.00, 79.80 7.00, 79.80 6.85)))'
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
      'Dashboard area B',
      extensions.ST_GeogFromText(
        'MULTIPOLYGON(((80.15 6.00, 80.30 6.00, 80.30 6.15, 80.15 6.15, 80.15 6.00)))'
      ),
      'ACTIVE'::"ServiceAreaStatus",
      NOW(),
      NOW()
    )
  `;

  const now = Date.now();
  await prisma.incident.createMany({
    data: [
      {
        id: incidentAId,
        reporterUserId: citizenAId,
        submissionId: randomUUID(),
        categoryId,
        title: "Organization A dashboard incident",
        description: "Incident visible only in Organization A's service area.",
        severity: "MEDIUM",
        status: "ACTIVE",
        latitude: 6.9271,
        longitude: 79.8612,
        highlightUntil: new Date(now + 48 * 60 * 60 * 1000),
        archiveAfter: new Date(now + 7 * 24 * 60 * 60 * 1000),
      },
      {
        id: incidentBId,
        reporterUserId: citizenBId,
        submissionId: randomUUID(),
        categoryId,
        title: "Organization B dashboard incident",
        description: "Incident visible only in Organization B's service area.",
        severity: "HIGH",
        status: "ACTIVE",
        latitude: 6.0535,
        longitude: 80.221,
        highlightUntil: new Date(now + 48 * 60 * 60 * 1000),
        archiveAfter: new Date(now + 7 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  await prisma.incidentReview.createMany({
    data: [
      {
        incidentId: incidentAId,
        organizationId: organizationAId,
        status: "VIEWED",
        privateNotes: "Organization A private dashboard note",
        reviewedByMembershipId: membershipAId,
      },
      {
        incidentId: incidentBId,
        organizationId: organizationBId,
        status: "FALSE",
        reasonCode: "NO_ISSUE_FOUND",
        privateNotes: "Organization B private dashboard note",
        reviewedByMembershipId: membershipBId,
      },
    ],
  });

  const initialWorkflowStatuses = await prisma.cleanupWorkflowStatus.findMany({
    where: {
      organizationId: { in: [organizationAId, organizationBId] },
      isInitial: true,
    },
    select: { id: true, organizationId: true },
  });
  workflowStatusAId = initialWorkflowStatuses.find(
    (status) => status.organizationId === organizationAId,
  )!.id;
  workflowStatusBId = initialWorkflowStatuses.find(
    (status) => status.organizationId === organizationBId,
  )!.id;

  await prisma.cleanupEvent.createMany({
    data: [
      {
        id: eventAId,
        organizationId: organizationAId,
        currentWorkflowStatusId: workflowStatusAId,
        lifecycleStatus: "DRAFT",
        createdByMembershipId: membershipAId,
        title: "Organization A dashboard event",
        description: "Organization A event summary fixture.",
        eventLatitude: 6.9271,
        eventLongitude: 79.8612,
      },
      {
        id: eventBId,
        organizationId: organizationBId,
        currentWorkflowStatusId: workflowStatusBId,
        lifecycleStatus: "DRAFT",
        createdByMembershipId: membershipBId,
        title: "Organization B dashboard event",
        description: "Organization B event summary fixture.",
        eventLatitude: 6.0535,
        eventLongitude: 80.221,
      },
    ],
  });

  const futureSessionDate = new Date();
  futureSessionDate.setUTCDate(futureSessionDate.getUTCDate() + 5);
  futureSessionDate.setUTCHours(0, 0, 0, 0);

  await prisma.eventSession.createMany({
    data: [
      {
        cleanupEventId: eventAId,
        sessionDate: futureSessionDate,
        startTime: new Date("1970-01-01T08:00:00.000Z"),
        endTime: new Date("1970-01-01T10:00:00.000Z"),
        status: "SCHEDULED",
      },
      {
        cleanupEventId: eventBId,
        sessionDate: futureSessionDate,
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T13:00:00.000Z"),
        status: "SCHEDULED",
      },
    ],
  });

  await prisma.eventParticipant.createMany({
    data: [
      {
        cleanupEventId: eventAId,
        userId: citizenAId,
        status: "JOINED",
      },
      {
        cleanupEventId: eventBId,
        userId: citizenBId,
        status: "JOINED",
      },
    ],
  });

  await prisma.organizationMembershipRequest.createMany({
    data: [
      {
        organizationId: organizationAId,
        requesterUserId: citizenBId,
        status: "PENDING",
      },
      {
        organizationId: organizationBId,
        requesterUserId: citizenAId,
        status: "PENDING",
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: citizenAId,
        type: "GENERAL",
        title: "Dashboard unread notification",
        message: "Unread summary fixture.",
      },
      {
        userId: citizenBId,
        type: "GENERAL",
        title: "Other user's notification",
        message: "Must not enter Citizen A's summary.",
      },
    ],
  });

  await prisma.contributionEvent.create({
    data: {
      userId: citizenAId,
      type: "SPECIAL_CONTRIBUTION",
      sourceKey: `dashboard-${randomUUID()}`,
      points: 5,
      recordedByUserId: superAdminId,
    },
  });

  const app = express();
  app.use(
    "/api/v1",
    createDashboardRouter(authenticationDependencies, {
      prisma,
      authorization: authorizationDependencies,
    }),
  );
  app.use(errorMiddleware);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server?.address() as AddressInfo).port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  const organizationIds = [organizationAId, organizationBId];
  const userIds = [citizenAId, citizenBId, superAdminId];

  await prisma.contributionEvent.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.notification.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.organizationMembershipRequest.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.eventParticipant.deleteMany({
    where: { cleanupEventId: { in: [eventAId, eventBId] } },
  });
  await prisma.eventSession.deleteMany({
    where: { cleanupEventId: { in: [eventAId, eventBId] } },
  });
  await prisma.cleanupEvent.deleteMany({
    where: { id: { in: [eventAId, eventBId] } },
  });
  await prisma.cleanupWorkflowStatus.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.incidentReview.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.incident.deleteMany({
    where: { id: { in: [incidentAId, incidentBId] } },
  });
  await prisma.organizationServiceArea.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.organizationMembership.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: organizationIds } },
  });
  await prisma.incidentCategory.deleteMany({
    where: { id: categoryId },
  });
  await prisma.userProfile.deleteMany({
    where: { id: { in: userIds } },
  });
});

test("citizen summary contains only the authenticated user's records", async () => {
  const response = await request("/dashboards/citizen", citizenAToken);
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    data: {
      reportsByState: Record<string, number>;
      joinedEvents: number;
      unreadNotifications: number;
      contributions: { count: number; points: number };
    };
  };

  assert.deepEqual(body.data.reportsByState, { ACTIVE: 1 });
  assert.equal(body.data.joinedEvents, 1);
  assert.equal(body.data.unreadNotifications, 1);
  assert.deepEqual(body.data.contributions, { count: 1, points: 5 });
});

test("organization summaries remain isolated across service areas and tenant data", async () => {
  const organizationAResponse = await request(
    `/organizations/${organizationAId}/dashboard-summary`,
    citizenAToken,
  );
  assert.equal(organizationAResponse.status, 200);

  const organizationASummary = (await organizationAResponse.json()) as {
    data: {
      organizationId: string;
      coveringIncidentsByState: Record<string, number>;
      reviewsByState: Record<string, number>;
      eventsByLifecycle: Record<string, number>;
      upcomingSessions: number;
      joinedParticipants: number;
      pendingMembershipRequests: number;
    };
  };

  assert.equal(organizationASummary.data.organizationId, organizationAId);
  assert.deepEqual(organizationASummary.data.coveringIncidentsByState, {
    ACTIVE: 1,
  });
  assert.deepEqual(organizationASummary.data.reviewsByState, { VIEWED: 1 });
  assert.deepEqual(organizationASummary.data.eventsByLifecycle, { DRAFT: 1 });
  assert.equal(organizationASummary.data.upcomingSessions, 1);
  assert.equal(organizationASummary.data.joinedParticipants, 1);
  assert.equal(organizationASummary.data.pendingMembershipRequests, 1);

  assert.equal(
    (
      await request(
        `/organizations/${organizationBId}/dashboard-summary`,
        citizenAToken,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/organizations/${organizationAId}/dashboard-summary`,
        citizenBToken,
      )
    ).status,
    403,
  );
});

test("platform summary exposes aggregates without tenant-private records", async () => {
  const response = await request("/dashboards/platform", superAdminToken);
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    data: {
      users: { total: number; active: number };
      organizationsByState: Record<string, number>;
      incidentsByState: Record<string, number>;
      eventsByLifecycle: Record<string, number>;
    };
  };

  assert.equal(body.data.users.total, initialPlatformUserCount + 3);
  assert.equal("items" in body.data, false);

  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("privateNotes"), false);
  assert.equal(serialized.includes("phoneNumber"), false);
  assert.equal(serialized.includes("officialEmail"), false);
});
