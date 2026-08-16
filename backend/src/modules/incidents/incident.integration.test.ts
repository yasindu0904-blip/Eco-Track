import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

import express from "express";

import { prisma } from "../../database/prisma.js";
import { AccountStatus, PlatformRole } from "../../generated/prisma/enums.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import type { IncidentDependencies } from "./incident.dependencies.js";
import { createIncidentRouter } from "./incident.routes.js";

const reporterId = randomUUID();
const reporterAuthId = randomUUID();
const otherReporterId = randomUUID();
const otherReporterAuthId = randomUUID();
const categoryId = randomUUID();
const reporterToken = `incident-reporter-${reporterId}`;
const otherToken = `incident-other-${otherReporterId}`;
const submissionId = randomUUID();
const uploadedPaths = new Set<string>();

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
      platformRole: PlatformRole.USER,
      accountStatus: AccountStatus.ACTIVE,
    };
  },
};

const dependencies: IncidentDependencies = {
  prisma,
  storage: {
    async createUploadIntent(storagePath) {
      uploadedPaths.add(storagePath);
      return { token: `token-${storagePath}`, signedUrl: `https://storage.test/${storagePath}` };
    },
    async objectExists(storagePath) { return uploadedPaths.has(storagePath); },
    async createDownloadUrl(storagePath) { return `https://download.test/${storagePath}`; },
  },
};

let server: Server | undefined;
let baseUrl = "";
let createdIncidentId = "";

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

before(async () => {
  await prisma.userProfile.createMany({
    data: Object.values(profiles).map((profile) => ({
      id: profile.id,
      authUserId: profile.authUserId,
      email: profile.email,
      fullName: profile.fullName,
      phoneNumber: profile.phoneNumber,
      profileCompletedAt: new Date(),
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

  const app = express();
  app.use(express.json());
  app.use("/api/v1", createIncidentRouter(authenticationDependencies, dependencies));
  app.use(errorMiddleware);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server?.address() as AddressInfo).port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
  await prisma.incident.deleteMany({ where: { reporterUserId: { in: [reporterId, otherReporterId] } } });
  await prisma.incidentCategory.deleteMany({ where: { id: categoryId } });
  await prisma.userProfile.deleteMany({ where: { id: { in: [reporterId, otherReporterId] } } });
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
  const body = await response.json() as { data: { id: string; status: string; statusHistory: unknown[]; highlightUntil: string; archiveAfter: string } };
  createdIncidentId = body.data.id;
  assert.equal(body.data.status, "ACTIVE");
  assert.equal(body.data.statusHistory.length, 1);
  assert.ok(new Date(body.data.archiveAfter) > new Date(body.data.highlightUntil));

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
