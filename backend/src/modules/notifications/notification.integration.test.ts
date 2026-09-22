import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before, beforeEach } from "node:test";

import express from "express";

import { prisma } from "../../database/prisma.js";
import {
  AccountStatus,
  NotificationType,
  PlatformRole,
} from "../../generated/prisma/enums.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";
import { notificationDependencies } from "./notification.dependencies.js";
import { createNotificationRouter } from "./notification.routes.js";
import { createNotification } from "./services/createNotification.service.js";
import type { NotificationDto, NotificationPageDto } from "./notification.types.js";

const userAId = randomUUID();
const userAAuthId = randomUUID();
const userBId = randomUUID();
const userBAuthId = randomUUID();
const incompleteUserId = randomUUID();
const incompleteUserAuthId = randomUUID();
const notificationIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()] as const;
const userBNotificationId = randomUUID();
const userAToken = `notification-a-${userAId}`;
const userBToken = `notification-b-${userBId}`;
const incompleteToken = `notification-incomplete-${incompleteUserId}`;

const authenticationDependencies: AuthenticationDependencies = {
  async verifyAccessToken(token) {
    const identities = new Map([
      [userAToken, { authUserId: userAAuthId, email: `a-${userAId}@example.com` }],
      [userBToken, { authUserId: userBAuthId, email: `b-${userBId}@example.com` }],
      [incompleteToken, { authUserId: incompleteUserAuthId, email: `incomplete-${incompleteUserId}@example.com` }],
    ]);
    return identities.get(token) ?? null;
  },
  async provisionOrSynchronizeProfile(identity) {
    const completed = identity.authUserId !== incompleteUserAuthId;
    const id = identity.authUserId === userAAuthId
      ? userAId
      : identity.authUserId === userBAuthId
        ? userBId
        : incompleteUserId;

    return {
      id,
      email: identity.email,
      fullName: completed ? "Notification Test User" : null,
      phoneNumber: completed ? "+94770000001" : null,
      profileCompletedAt: completed ? new Date() : null,
      platformRole: PlatformRole.USER,
      accountStatus: AccountStatus.ACTIVE,
    };
  },
};

let server: Server | undefined;
let baseUrl = "";

function request(token: string, path: string, options: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...options.headers,
    },
  });
}

before(async () => {
  await prisma.userProfile.createMany({
    data: [
      { id: userAId, authUserId: userAAuthId, email: `a-${userAId}@example.com`, fullName: "User A", phoneNumber: "+94770000001", profileCompletedAt: new Date() },
      { id: userBId, authUserId: userBAuthId, email: `b-${userBId}@example.com`, fullName: "User B", phoneNumber: "+94770000002", profileCompletedAt: new Date() },
      { id: incompleteUserId, authUserId: incompleteUserAuthId, email: `incomplete-${incompleteUserId}@example.com` },
    ],
  });

  const app = express();
  app.use(express.json());
  app.use("/api/v1", createNotificationRouter(authenticationDependencies, notificationDependencies));
  app.use(errorMiddleware);
  await new Promise<void>((resolve) => {
    server = app.listen(
      0,
      "127.0.0.1",
      () => resolve(),
    );
  });
  baseUrl = `http://127.0.0.1:${(server?.address() as AddressInfo).port}`;
});

beforeEach(async () => {
  await prisma.notification.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
  await prisma.notification.createMany({
    data: [
      { id: notificationIds[0], userId: userAId, type: NotificationType.ORGANIZATION_REVIEW_UPDATED, title: "Newest", message: "Newest unread", data: { organizationId: randomUUID(), status: "ACTIVE", privateNotes: "secret", phoneNumber: "+94779999999" }, createdAt: new Date("2026-08-15T10:05:00Z") },
      { id: notificationIds[1], userId: userAId, type: NotificationType.EVENT_PUBLISHED, title: "Second", message: "Second unread", data: { eventId: randomUUID() }, createdAt: new Date("2026-08-15T10:04:00Z") },
      { id: notificationIds[2], userId: userAId, type: NotificationType.GENERAL, title: "Read", message: "Already read", readAt: new Date("2026-08-15T10:03:30Z"), createdAt: new Date("2026-08-15T10:03:00Z") },
      { id: notificationIds[3], userId: userAId, type: NotificationType.MEMBERSHIP_UPDATED, title: "Oldest", message: "Oldest unread", createdAt: new Date("2026-08-15T10:02:00Z") },
      { id: userBNotificationId, userId: userBId, type: NotificationType.GENERAL, title: "User B", message: "Private to B", createdAt: new Date("2026-08-15T10:06:00Z") },
    ],
  });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
  }
  await prisma.notification.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
  await prisma.userProfile.deleteMany({ where: { id: { in: [userAId, userBId, incompleteUserId] } } });
  await prisma.$disconnect();
});

test("notification routes enforce authentication and profile completion", async () => {
  assert.equal((await fetch(`${baseUrl}/api/v1/notifications`)).status, 401);
  assert.equal((await request("invalid", "/api/v1/notifications")).status, 401);
  assert.equal((await request(incompleteToken, "/api/v1/notifications")).status, 403);
});

test("the inbox is user-owned, privacy-safe, newest-first, and cursor paginated", async () => {
  const first = await request(userAToken, "/api/v1/notifications?limit=2");
  assert.equal(first.status, 200);
  const firstBody = await first.json() as { data: NotificationPageDto };
  assert.deepEqual(firstBody.data.items.map(({ id }) => id), [notificationIds[0], notificationIds[1]]);
  assert.deepEqual(Object.keys(firstBody.data.items[0]?.data ?? {}).sort(), ["organizationId", "status"]);
  assert.ok(firstBody.data.nextCursor);

  const second = await request(userAToken, `/api/v1/notifications?limit=2&cursor=${encodeURIComponent(firstBody.data.nextCursor)}`);
  const secondBody = await second.json() as { data: NotificationPageDto };
  assert.deepEqual(secondBody.data.items.map(({ id }) => id), [notificationIds[2], notificationIds[3]]);
  assert.equal(secondBody.data.nextCursor, null);
  assert.equal([...firstBody.data.items, ...secondBody.data.items].some(({ id }) => id === userBNotificationId), false);
  assert.equal((await request(userAToken, "/api/v1/notifications?cursor=invalid")).status, 400);
});

test("unread filtering, count, mark-one, and mark-all remain consistent and idempotent", async () => {
  const unread = await request(userAToken, "/api/v1/notifications?unreadOnly=true");
  const unreadBody = await unread.json() as { data: NotificationPageDto };
  assert.deepEqual(unreadBody.data.items.map(({ id }) => id), [notificationIds[0], notificationIds[1], notificationIds[3]]);

  const count = await request(userAToken, "/api/v1/notifications/unread-count");
  assert.deepEqual(await count.json(), { data: { unreadCount: 3 } });

  const path = `/api/v1/notifications/${notificationIds[0]}/read`;
  const firstRead = await request(userAToken, path, { method: "PATCH" });
  const firstReadBody = await firstRead.json() as { data: NotificationDto };
  const secondRead = await request(userAToken, path, { method: "PATCH" });
  const secondReadBody = await secondRead.json() as { data: NotificationDto };
  assert.equal(secondReadBody.data.readAt, firstReadBody.data.readAt);

  const firstAll = await request(userAToken, "/api/v1/notifications/read-all", { method: "PATCH" });
  assert.equal(((await firstAll.json()) as { data: { markedReadCount: number } }).data.markedReadCount, 2);
  const secondAll = await request(userAToken, "/api/v1/notifications/read-all", { method: "PATCH" });
  assert.equal(((await secondAll.json()) as { data: { markedReadCount: number } }).data.markedReadCount, 0);
});

test("another user's notification ID cannot be read or mutated", async () => {
  const response = await request(userAToken, `/api/v1/notifications/${userBNotificationId}/read`, { method: "PATCH" });
  assert.equal(response.status, 404);
  assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: userBNotificationId } })).readAt, null);
  assert.equal((await request(userAToken, "/api/v1/notifications/not-a-uuid/read", { method: "PATCH" })).status, 400);
});

test("the reusable internal creation service creates normalized safe rows", async () => {
  const created = await createNotification(notificationDependencies, {
    userId: userAId,
    type: NotificationType.GENERAL,
    title: "  Internal notification  ",
    message: "  Created through the reusable service.  ",
    data: { incidentId: randomUUID(), status: "ACTIVE" },
  });
  assert.equal(created.title, "Internal notification");
  assert.equal(created.message, "Created through the reusable service.");
  assert.equal(created.data?.status, "ACTIVE");
});
