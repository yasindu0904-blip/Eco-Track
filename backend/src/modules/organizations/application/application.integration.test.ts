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
import { createAdministrativeAreaRouter } from "../../administrativeAreas/administrativeArea.routes.js";
import type { AuthenticationDependencies } from "../../auth/auth.types.js";

import { organizationApplicationDependencies } from "./application.dependencies.js";
import { createOrganizationApplicationRouter } from "./application.routes.js";

const testProfileId = randomUUID();
const testAuthUserId = randomUUID();
const otherProfileId = randomUUID();
const otherAuthUserId = randomUUID();
const testEmail = `organization-application-${testProfileId}@example.com`;
const validAccessToken = `test-token-${testProfileId}`;
const testAdministrativeAreaId = randomUUID();

const authenticationDependencies: AuthenticationDependencies = {
  async verifyAccessToken(accessToken) {
    if (accessToken !== validAccessToken) {
      return null;
    }

    return {
      authUserId: testAuthUserId,
      email: testEmail,
    };
  },

  async provisionOrSynchronizeProfile() {
    return {
      id: testProfileId,
      email: testEmail,
      fullName: "Organization Application Test User",
      phoneNumber: "+94770000001",
      profileCompletedAt: new Date(),
      platformRole: PlatformRole.USER,
      accountStatus: AccountStatus.ACTIVE,
    };
  },
};

let server: Server | undefined;
let baseUrl = "";
let createdApplicationId: string | undefined;
let otherApplicationId: string | undefined;

function validApplicationBody(name: string) {
  return {
    name,
    registrationNumber: `TEST-${testProfileId.slice(0, 8)}`,
    description: "Created by the organization application integration test.",
    officialEmail: `office-${testProfileId}@example.com`,
    officialPhone: "+94 77 123 4567",
    officialAddress: "Test address, Colombo, Sri Lanka",
    administrativeAreaIds: [testAdministrativeAreaId],
  };
}

async function postApplication(body: unknown) {
  return fetch(`${baseUrl}/api/v1/organization-applications`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${validAccessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

before(async () => {
  await prisma.$executeRaw`
    INSERT INTO "administrative_areas" (
      "id",
      "level",
      "official_code",
      "name_en",
      "divisional_secretariat_name",
      "district_name",
      "province_name",
      "boundary",
      "source_name",
      "source_version",
      "updated_at"
    ) VALUES (
      ${testAdministrativeAreaId}::uuid,
      'GN_DIVISION'::"AdministrativeAreaLevel",
      ${`TEST-${testAdministrativeAreaId}`},
      'Integration Test GN Division',
      'Test DS Division',
      'Test District',
      'Test Province',
      extensions.ST_GeogFromText(
        'SRID=4326;MULTIPOLYGON(((79.85 6.92,79.86 6.92,79.86 6.93,79.85 6.92)))'
      ),
      'EcoTrack integration test',
      'test-v1',
      CURRENT_TIMESTAMP
    )
  `;

  await prisma.userProfile.createMany({
    data: [
      {
        id: testProfileId,
        authUserId: testAuthUserId,
        email: testEmail,
        fullName: "Organization Application Test User",
      },
      {
        id: otherProfileId,
        authUserId: otherAuthUserId,
        email: `other-applicant-${otherProfileId}@example.com`,
      },
    ],
  });

  const otherApplication = await prisma.organization.create({
    data: {
      requestedByUserId: otherProfileId,
      name: "Another User Private Application",
      slug: `another-user-private-${otherProfileId}`,
      officialEmail: `other-office-${otherProfileId}@example.com`,
      officialPhone: "+94 77 000 0000",
      officialAddress: "Private integration test address",
    },
  });
  otherApplicationId = otherApplication.id;

  const app = express();
  app.use(express.json());
  app.use(
    "/api/v1",
    createAdministrativeAreaRouter(
      authenticationDependencies,
      organizationApplicationDependencies,
    ),
  );
  app.use(
    "/api/v1",
    createOrganizationApplicationRouter(
      authenticationDependencies,
      organizationApplicationDependencies,
    ),
  );
  app.use(errorMiddleware);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });

  if (!server) {
    throw new Error("The integration-test HTTP server did not start.");
  }

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  await prisma.auditLog.deleteMany({
    where: { actorUserId: testProfileId },
  });
  await prisma.organization.deleteMany({
    where: {
      requestedByUserId: {
        in: [testProfileId, otherProfileId],
      },
    },
  });
  await prisma.userProfile.deleteMany({
    where: {
      id: {
        in: [testProfileId, otherProfileId],
      },
    },
  });
  await prisma.administrativeArea.delete({
    where: { id: testAdministrativeAreaId },
  });
  await prisma.$disconnect();
});

test("rejects a missing bearer token", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/organization-applications`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validApplicationBody("Missing Token Test")),
    },
  );

  assert.equal(response.status, 401);
});

test("searches active GN Division references for the authenticated user", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/administrative-areas?search=${encodeURIComponent(testAdministrativeAreaId)}`,
    {
      headers: {
        authorization: `Bearer ${validAccessToken}`,
      },
    },
  );

  assert.equal(response.status, 200);

  const responseBody = (await response.json()) as {
    data: Array<{ id: string; name: string }>;
  };

  assert.equal(responseBody.data.length, 1);
  assert.equal(responseBody.data[0]?.id, testAdministrativeAreaId);
  assert.equal(responseBody.data[0]?.name, "Integration Test GN Division");
});

test("rejects requester-controlled security fields", async () => {
  const response = await postApplication({
    ...validApplicationBody("Unauthorized Field Test"),
    requestedByUserId: randomUUID(),
  });

  assert.equal(response.status, 400);
});

test("rejects an unknown GN Division without creating an organization", async () => {
  const organizationName = `Unknown Area ${testProfileId}`;
  const body = {
    ...validApplicationBody(organizationName),
    administrativeAreaIds: [randomUUID()],
  };

  const response = await postApplication(body);
  assert.equal(response.status, 422);

  const createdCount = await prisma.organization.count({
    where: {
      requestedByUserId: testProfileId,
      name: organizationName,
    },
  });
  assert.equal(createdCount, 0);
});

test("creates pending records and no membership", async () => {
  const organizationName = `Valid Application ${testProfileId}`;
  const response = await postApplication(
    validApplicationBody(organizationName),
  );

  assert.equal(response.status, 201);

  const responseBody = (await response.json()) as {
    data: {
      id: string;
      status: string;
      serviceAreas: Array<{ status: string }>;
    };
  };
  createdApplicationId = responseBody.data.id;

  assert.equal(responseBody.data.status, "PENDING_REVIEW");
  assert.equal(responseBody.data.serviceAreas.length, 1);
  assert.equal(
    responseBody.data.serviceAreas[0]?.status,
    "PENDING_REVIEW",
  );

  const organization = await prisma.organization.findUnique({
    where: { id: createdApplicationId },
    select: {
      requestedByUserId: true,
      status: true,
      serviceAreas: { select: { id: true, status: true } },
      memberships: { select: { id: true } },
      auditLogs: {
        where: { action: "ORGANIZATION_APPLICATION_SUBMITTED" },
        select: { id: true },
      },
    },
  });

  assert.ok(organization);
  assert.equal(organization.requestedByUserId, testProfileId);
  assert.equal(organization.status, "PENDING_REVIEW");
  assert.equal(organization.serviceAreas.length, 1);
  assert.equal(organization.serviceAreas[0]?.status, "PENDING_REVIEW");
  assert.equal(organization.memberships.length, 0);
  assert.equal(organization.auditLogs.length, 1);
});

test("lists only applications owned by the authenticated requester", async () => {
  assert.ok(createdApplicationId);

  const response = await fetch(
    `${baseUrl}/api/v1/organization-applications/me`,
    {
      headers: {
        authorization: `Bearer ${validAccessToken}`,
      },
    },
  );

  assert.equal(response.status, 200);

  const responseBody = (await response.json()) as {
    data: Array<{ id: string; name: string }>;
  };

  assert.equal(
    responseBody.data.some(
      (application) => application.id === createdApplicationId,
    ),
    true,
  );
  assert.equal(
    responseBody.data.some(
      (application) =>
        application.name === "Another User Private Application",
    ),
    false,
  );
});

test("reads an owned application and hides another requester's application", async () => {
  assert.ok(createdApplicationId);
  assert.ok(otherApplicationId);

  const ownedResponse = await fetch(
    `${baseUrl}/api/v1/organization-applications/me/${createdApplicationId}`,
    {
      headers: {
        authorization: `Bearer ${validAccessToken}`,
      },
    },
  );

  assert.equal(ownedResponse.status, 200);

  const ownedBody = (await ownedResponse.json()) as {
    data: { id: string; status: string };
  };
  assert.equal(ownedBody.data.id, createdApplicationId);
  assert.equal(ownedBody.data.status, "PENDING_REVIEW");

  const otherResponse = await fetch(
    `${baseUrl}/api/v1/organization-applications/me/${otherApplicationId}`,
    {
      headers: {
        authorization: `Bearer ${validAccessToken}`,
      },
    },
  );

  assert.equal(otherResponse.status, 404);
});
