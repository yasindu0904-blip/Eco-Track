import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

import express from "express";

import { prisma } from "../../../database/prisma.js";
import {
  AccountStatus,
  PlatformRole,
} from "../../../generated/prisma/enums.js";
import { errorMiddleware } from "../../../middleware/error.middleware.js";
import type { AuthenticationDependencies } from "../../auth/auth.types.js";
import { notificationDependencies } from "../../notifications/notification.dependencies.js";
import { createNotificationRouter } from "../../notifications/notification.routes.js";
import type { NotificationPageDto } from "../../notifications/notification.types.js";
import { organizationApplicationDependencies } from "../application/application.dependencies.js";
import { createOrganizationReviewRouter } from "./organizationReview.routes.js";

const superAdminId = randomUUID();
const superAdminAuthId = randomUUID();
const applicantId = randomUUID();
const applicantAuthId = randomUUID();
const administrativeAreaId = randomUUID();
const approveOrganizationId = randomUUID();
const declineOrganizationId = randomUUID();
const superAdminToken = `super-admin-${superAdminId}`;
const applicantToken = `applicant-${applicantId}`;

const authenticationDependencies: AuthenticationDependencies = {
  async verifyAccessToken(token) {
    if (token === superAdminToken) {
      return {
        authUserId: superAdminAuthId,
        email: `review-admin-${superAdminId}@example.com`,
      };
    }

    if (token === applicantToken) {
      return {
        authUserId: applicantAuthId,
        email: `review-applicant-${applicantId}@example.com`,
      };
    }

    return null;
  },

  async provisionOrSynchronizeProfile(identity) {
    const isAdmin = identity.authUserId === superAdminAuthId;

    return {
      id: isAdmin ? superAdminId : applicantId,
      email: identity.email,
      fullName: isAdmin ? "Review Test Super Admin" : "Review Test Applicant",
      phoneNumber: isAdmin ? "+94770000002" : "+94770000003",
      profileCompletedAt: new Date(),
      platformRole: isAdmin ? PlatformRole.SUPER_ADMIN : PlatformRole.USER,
      accountStatus: AccountStatus.ACTIVE,
    };
  },
};

let server: Server | undefined;
let baseUrl = "";

function adminRequest(path: string, options: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${superAdminToken}`,
      "content-type": "application/json",
      ...options.headers,
    },
  });
}

function applicantRequest(path: string, options: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${applicantToken}`,
      "content-type": "application/json",
      ...options.headers,
    },
  });
}

before(async () => {
  await prisma.userProfile.createMany({
    data: [
      {
        id: superAdminId,
        authUserId: superAdminAuthId,
        email: `review-admin-${superAdminId}@example.com`,
        fullName: "Review Test Super Admin",
        platformRole: PlatformRole.SUPER_ADMIN,
      },
      {
        id: applicantId,
        authUserId: applicantAuthId,
        email: `review-applicant-${applicantId}@example.com`,
        fullName: "Review Test Applicant",
      },
    ],
  });

  await prisma.$executeRaw`
    INSERT INTO "administrative_areas" (
      "id", "level", "official_code", "name_en", "boundary",
      "source_name", "source_version", "updated_at"
    ) VALUES (
      ${administrativeAreaId}::uuid,
      'GN_DIVISION'::"AdministrativeAreaLevel",
      ${`REVIEW-${administrativeAreaId}`},
      'Review Test GN Division',
      extensions.ST_GeogFromText(
        'SRID=4326;MULTIPOLYGON(((79.85 6.92,79.86 6.92,79.86 6.93,79.85 6.92)))'
      ),
      'EcoTrack integration test',
      'test-v1',
      CURRENT_TIMESTAMP
    )
  `;

  await prisma.organization.createMany({
    data: [
      {
        id: approveOrganizationId,
        requestedByUserId: applicantId,
        name: "Organization To Approve",
        slug: `approve-${approveOrganizationId}`,
        officialEmail: "approve@example.com",
        officialPhone: "+94 77 111 1111",
        officialAddress: "Approval test address",
      },
      {
        id: declineOrganizationId,
        requestedByUserId: applicantId,
        name: "Organization To Decline",
        slug: `decline-${declineOrganizationId}`,
        officialEmail: "decline@example.com",
        officialPhone: "+94 77 222 2222",
        officialAddress: "Decline test address",
      },
    ],
  });

  await prisma.organizationServiceArea.createMany({
    data: [
      {
        organizationId: approveOrganizationId,
        administrativeAreaId,
      },
      {
        organizationId: declineOrganizationId,
        administrativeAreaId,
      },
    ],
  });

  const app = express();
  app.use(express.json());
  app.use(
    "/api/v1",
    createOrganizationReviewRouter(
      authenticationDependencies,
      organizationApplicationDependencies,
    ),
  );
  app.use(
    "/api/v1",
    createNotificationRouter(
      authenticationDependencies,
      notificationDependencies,
    ),
  );
  app.use(errorMiddleware);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server?.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  }

  await prisma.notification.deleteMany({ where: { userId: applicantId } });
  await prisma.organizationMembership.deleteMany({ where: { userId: applicantId } });
  await prisma.auditLog.deleteMany({ where: { actorUserId: superAdminId } });
  await prisma.organization.deleteMany({
    where: { id: { in: [approveOrganizationId, declineOrganizationId] } },
  });
  await prisma.userProfile.deleteMany({
    where: { id: { in: [superAdminId, applicantId] } },
  });
  await prisma.administrativeArea.delete({ where: { id: administrativeAreaId } });
  await prisma.$disconnect();
});

test("a normal user cannot open the Super Admin review queue", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/super-admin/organization-applications`,
    { headers: { authorization: `Bearer ${applicantToken}` } },
  );

  assert.equal(response.status, 403);
});

test("a Super Admin can list pending applications", async () => {
  const response = await adminRequest(
    "/api/v1/super-admin/organization-applications",
  );
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    data: Array<{ id: string; serviceAreas: Array<{ name: string }> }>;
  };
  assert.equal(
    body.data.some((application) => application.id === approveOrganizationId),
    true,
  );
  assert.equal(
    body.data.find((application) => application.id === approveOrganizationId)
      ?.serviceAreas[0]?.name,
    "Review Test GN Division",
  );
});

test("approval activates the organization and creates its first admin atomically", async () => {
  const response = await adminRequest(
    `/api/v1/super-admin/organization-applications/${approveOrganizationId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({ reviewNotes: "Verified for the integration test." }),
    },
  );
  assert.equal(response.status, 200);

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: approveOrganizationId },
    include: {
      serviceAreas: true,
      memberships: true,
      auditLogs: true,
      notifications: true,
    },
  });

  assert.equal(organization.status, "ACTIVE");
  assert.equal(organization.serviceAreas[0]?.status, "ACTIVE");
  assert.equal(organization.memberships[0]?.userId, applicantId);
  assert.equal(organization.memberships[0]?.role, "ORG_ADMIN");
  assert.equal(organization.memberships[0]?.source, "FIRST_ADMIN");
  assert.equal(organization.auditLogs[0]?.action, "ORGANIZATION_APPLICATION_APPROVED");
  assert.equal(organization.notifications.length, 1);

  const inboxResponse = await applicantRequest(
    "/api/v1/notifications?unreadOnly=true",
  );
  assert.equal(inboxResponse.status, 200);

  const inboxBody = (await inboxResponse.json()) as {
    data: NotificationPageDto;
  };
  const approvalNotification = inboxBody.data.items.find(
    (notification) =>
      notification.data?.organizationId === approveOrganizationId,
  );

  assert.equal(approvalNotification?.type, "ORGANIZATION_REVIEW_UPDATED");
  assert.equal(approvalNotification?.data?.status, "ACTIVE");
  assert.equal(approvalNotification?.readAt, null);
});

test("an application cannot be reviewed twice", async () => {
  const response = await adminRequest(
    `/api/v1/super-admin/organization-applications/${approveOrganizationId}/approve`,
    { method: "POST", body: JSON.stringify({}) },
  );

  assert.equal(response.status, 409);
});

test("decline requires notes and creates no membership", async () => {
  const invalidResponse = await adminRequest(
    `/api/v1/super-admin/organization-applications/${declineOrganizationId}/decline`,
    { method: "POST", body: JSON.stringify({}) },
  );
  assert.equal(invalidResponse.status, 400);

  const response = await adminRequest(
    `/api/v1/super-admin/organization-applications/${declineOrganizationId}/decline`,
    {
      method: "POST",
      body: JSON.stringify({ reviewNotes: "Required information was not verified." }),
    },
  );
  assert.equal(response.status, 200);

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: declineOrganizationId },
    include: {
      serviceAreas: true,
      memberships: true,
      auditLogs: true,
      notifications: true,
    },
  });

  assert.equal(organization.status, "DECLINED");
  assert.equal(organization.reviewNotes, "Required information was not verified.");
  assert.equal(organization.serviceAreas[0]?.status, "REJECTED");
  assert.equal(organization.memberships.length, 0);
  assert.equal(organization.auditLogs[0]?.action, "ORGANIZATION_APPLICATION_DECLINED");
  assert.equal(organization.notifications.length, 1);

  const inboxResponse = await applicantRequest(
    "/api/v1/notifications?unreadOnly=true",
  );
  assert.equal(inboxResponse.status, 200);

  const inboxBody = (await inboxResponse.json()) as {
    data: NotificationPageDto;
  };
  const declineNotification = inboxBody.data.items.find(
    (notification) =>
      notification.data?.organizationId === declineOrganizationId,
  );

  assert.equal(declineNotification?.type, "ORGANIZATION_REVIEW_UPDATED");
  assert.equal(declineNotification?.data?.status, "DECLINED");
  assert.equal(declineNotification?.readAt, null);
});
