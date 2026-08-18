import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before, beforeEach } from "node:test";

import express from "express";

import { buildAbilityForRequest } from "../../authorization/ability.factory.js";
import { Actions } from "../../authorization/actions.js";
import { Subjects } from "../../authorization/subjects.js";
import { prisma } from "../../database/prisma.js";
import { ApplicationError } from "../../errors/applicationError.js";
import {
  AccountStatus,
  AllocationStatus,
  CleanupLifecycleStatus,
  ContributionType,
  IncidentReviewStatus,
  IncidentSeverity,
  MembershipRole,
  MembershipSource,
  MembershipStatus,
  NotificationType,
  OrganizationStatus,
  ParticipantStatus,
  PlatformRole,
} from "../../generated/prisma/enums.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
import type {
  AuthenticatedUserProfile,
  AuthenticationDependencies,
} from "../auth/auth.types.js";

import type {
  CompletedCleanupEventHistoryDto,
  ContributionPageDto,
  ImpactSummaryDto,
} from "./reward.types.js";
import { rewardDependencies } from "./reward.dependencies.js";
import { createRewardRouter } from "./reward.routes.js";
import {
  awardApprovedSpecialContribution,
  awardCompletedEventContribution,
  awardSessionAttendanceContribution,
  awardVerifiedIncidentReportContribution,
} from "./services/awardContribution.service.js";

const userAId = randomUUID();
const userAAuthId = randomUUID();
const userBId = randomUUID();
const userBAuthId = randomUUID();
const incompleteUserId = randomUUID();
const incompleteUserAuthId = randomUUID();
const organizationId = randomUUID();
const membershipId = randomUUID();
const categoryId = randomUUID();
const verifiedIncidentId = randomUUID();
const unverifiedIncidentId = randomUUID();
const workflowStatusId = randomUUID();
const cleanupEventId = randomUUID();
const participantId = randomUUID();
const attendedSessionId = randomUUID();
const plannedSessionId = randomUUID();
const attendedAllocationId = randomUUID();
const plannedAllocationId = randomUUID();
const userAToken = `reward-a-${userAId}`;
const userBToken = `reward-b-${userBId}`;
const incompleteToken = `reward-incomplete-${incompleteUserId}`;

function profile(
  id: string,
  email: string,
  completed = true,
): AuthenticatedUserProfile {
  return {
    id,
    email,
    fullName: completed ? "Reward Test User" : null,
    phoneNumber: completed ? "+94770000001" : null,
    profileCompletedAt: completed ? new Date() : null,
    platformRole: PlatformRole.USER,
    accountStatus: AccountStatus.ACTIVE,
  };
}

const profileA = profile(userAId, `reward-a-${userAId}@example.com`);
const profileB = profile(userBId, `reward-b-${userBId}@example.com`);
const incompleteProfile = profile(
  incompleteUserId,
  `reward-incomplete-${incompleteUserId}@example.com`,
  false,
);

const authenticationDependencies: AuthenticationDependencies = {
  async verifyAccessToken(token) {
    if (token === userAToken) return { authUserId: userAAuthId, email: profileA.email };
    if (token === userBToken) return { authUserId: userBAuthId, email: profileB.email };
    if (token === incompleteToken) {
      return { authUserId: incompleteUserAuthId, email: incompleteProfile.email };
    }
    return null;
  },
  async provisionOrSynchronizeProfile(identity) {
    if (identity.authUserId === userAAuthId) return profileA;
    if (identity.authUserId === userBAuthId) return profileB;
    return incompleteProfile;
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
      ...options.headers,
    },
  });
}

before(async () => {
  await prisma.userProfile.createMany({
    data: [
      { id: userAId, authUserId: userAAuthId, email: profileA.email, fullName: profileA.fullName, phoneNumber: profileA.phoneNumber, profileCompletedAt: profileA.profileCompletedAt },
      { id: userBId, authUserId: userBAuthId, email: profileB.email, fullName: profileB.fullName, phoneNumber: profileB.phoneNumber, profileCompletedAt: profileB.profileCompletedAt },
      { id: incompleteUserId, authUserId: incompleteUserAuthId, email: incompleteProfile.email },
    ],
  });
  await prisma.organization.create({
    data: {
      id: organizationId,
      requestedByUserId: userBId,
      name: "Reward Test Organization",
      slug: `reward-${organizationId}`,
      officialEmail: `reward-org-${organizationId}@example.com`,
      officialPhone: "+94770000002",
      officialAddress: "Reward integration test address",
      status: OrganizationStatus.ACTIVE,
    },
  });
  await prisma.organizationMembership.create({
    data: {
      id: membershipId,
      organizationId,
      userId: userBId,
      role: MembershipRole.ORG_ADMIN,
      status: MembershipStatus.ACTIVE,
      source: MembershipSource.FIRST_ADMIN,
    },
  });
  await prisma.incidentCategory.create({
    data: { id: categoryId, name: `Reward Category ${categoryId}`, isActive: true },
  });
  const incidentNow = Date.now();
  const incidentTimes = {
    highlightUntil: new Date(incidentNow + 48 * 60 * 60 * 1000),
    archiveAfter: new Date(incidentNow + 7 * 24 * 60 * 60 * 1000),
  };
  await prisma.incident.createMany({
    data: [
      {
        id: verifiedIncidentId,
        reporterUserId: userAId,
        submissionId: randomUUID(),
        categoryId,
        title: "Verified reward test incident",
        description: "A verified incident used only by the rewards integration test.",
        severity: IncidentSeverity.MEDIUM,
        latitude: 6.9271,
        longitude: 79.8612,
        ...incidentTimes,
      },
      {
        id: unverifiedIncidentId,
        reporterUserId: userAId,
        submissionId: randomUUID(),
        categoryId,
        title: "Unverified reward test incident",
        description: "An unverified incident must never award report points.",
        severity: IncidentSeverity.LOW,
        latitude: 6.9272,
        longitude: 79.8613,
        ...incidentTimes,
      },
    ],
  });
  await prisma.incidentReview.create({
    data: {
      incidentId: verifiedIncidentId,
      organizationId,
      status: IncidentReviewStatus.VALID,
      reviewedByMembershipId: membershipId,
      reviewedAt: new Date(),
    },
  });
  await prisma.cleanupWorkflowStatus.create({
    data: {
      id: workflowStatusId,
      organizationId,
      code: `DONE_${workflowStatusId}`,
      label: "Completed",
      mappedLifecycleStatus: CleanupLifecycleStatus.COMPLETED,
      position: 99,
      isFinal: true,
    },
  });
  await prisma.cleanupEvent.create({
    data: {
      id: cleanupEventId,
      organizationId,
      currentWorkflowStatusId: workflowStatusId,
      lifecycleStatus: CleanupLifecycleStatus.COMPLETED,
      createdByMembershipId: membershipId,
      title: "Reward cleanup event",
      description: "Completed cleanup event for reward integration tests.",
      eventLatitude: 6.9271,
      eventLongitude: 79.8612,
      publishedAt: new Date("2026-08-16T00:00:00Z"),
      completedAt: new Date(),
    },
  });
  await prisma.eventParticipant.create({
    data: {
      id: participantId,
      cleanupEventId,
      userId: userAId,
      status: ParticipantStatus.JOINED,
    },
  });
  await prisma.eventSession.createMany({
    data: [
      {
        id: attendedSessionId,
        cleanupEventId,
        sessionDate: new Date("2026-08-17T00:00:00Z"),
        startTime: new Date("1970-01-01T08:00:00Z"),
        endTime: new Date("1970-01-01T10:00:00Z"),
      },
      {
        id: plannedSessionId,
        cleanupEventId,
        sessionDate: new Date("2026-08-18T00:00:00Z"),
        startTime: new Date("1970-01-01T08:00:00Z"),
        endTime: new Date("1970-01-01T10:00:00Z"),
      },
    ],
  });
  await prisma.sessionAllocation.createMany({
    data: [
      {
        id: attendedAllocationId,
        participantId,
        sessionId: attendedSessionId,
        allocatedByMembershipId: membershipId,
        status: AllocationStatus.ATTENDED,
        attendanceMarkedByMembershipId: membershipId,
        attendanceMarkedAt: new Date(),
      },
      {
        id: plannedAllocationId,
        participantId,
        sessionId: plannedSessionId,
        allocatedByMembershipId: membershipId,
        status: AllocationStatus.PLANNED,
      },
    ],
  });

  const app = express();
  app.use(express.json());
  app.use("/api/v1", createRewardRouter(authenticationDependencies, rewardDependencies));
  app.use(errorMiddleware);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server?.address() as AddressInfo).port}`;
});

beforeEach(async () => {
  await prisma.notification.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
  await prisma.userAchievement.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
  await prisma.contributionEvent.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => error ? reject(error) : resolve());
    });
  }
  await prisma.notification.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
  await prisma.userAchievement.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
  await prisma.contributionEvent.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
  await prisma.sessionAllocation.deleteMany({ where: { id: { in: [attendedAllocationId, plannedAllocationId] } } });
  await prisma.eventSession.deleteMany({ where: { id: { in: [attendedSessionId, plannedSessionId] } } });
  await prisma.eventParticipant.deleteMany({ where: { id: participantId } });
  await prisma.cleanupEvent.deleteMany({ where: { id: cleanupEventId } });
  await prisma.cleanupWorkflowStatus.deleteMany({ where: { id: workflowStatusId } });
  await prisma.incidentReview.deleteMany({ where: { incidentId: { in: [verifiedIncidentId, unverifiedIncidentId] } } });
  await prisma.incident.deleteMany({ where: { id: { in: [verifiedIncidentId, unverifiedIncidentId] } } });
  await prisma.incidentCategory.deleteMany({ where: { id: categoryId } });
  await prisma.organizationMembership.deleteMany({ where: { id: membershipId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.userProfile.deleteMany({ where: { id: { in: [userAId, userBId, incompleteUserId] } } });
  await prisma.$disconnect();
});

test("reward routes require authentication and a completed profile", async () => {
  assert.equal((await fetch(`${baseUrl}/api/v1/rewards/me/summary`)).status, 401);
  assert.equal((await request("invalid", "/api/v1/rewards/me/summary")).status, 401);
  assert.equal((await request(incompleteToken, "/api/v1/rewards/me/summary")).status, 403);
});

test("a VALID incident awards once, earns an achievement once, and notifies once", async () => {
  const [first, retry] = await prisma.$transaction(async (transaction) => {
    const created = await awardVerifiedIncidentReportContribution(transaction, verifiedIncidentId);
    const duplicate = await awardVerifiedIncidentReportContribution(transaction, verifiedIncidentId);
    return [created, duplicate];
  });

  assert.equal(first.created, true);
  assert.equal(first.points, 20);
  assert.equal(retry.created, false);
  assert.equal(await prisma.contributionEvent.count({ where: { userId: userAId } }), 1);
  assert.equal(retry.newAchievementIds.length, 0);
  assert.equal(await prisma.userAchievement.count({
    where: {
      userId: userAId,
      achievement: { code: "GREEN_STARTER" },
    },
  }), 1);
  assert.equal(
    await prisma.notification.count({
      where: { userId: userAId, type: NotificationType.ACHIEVEMENT_AWARDED },
    }),
    first.newAchievementIds.length,
  );
});

test("report submission without a VALID review cannot award points", async () => {
  await assert.rejects(
    prisma.$transaction((transaction) =>
      awardVerifiedIncidentReportContribution(transaction, unverifiedIncidentId),
    ),
    (error: unknown) => error instanceof ApplicationError && error.code === "INCIDENT_NOT_VERIFIED",
  );
  assert.equal(await prisma.contributionEvent.count({ where: { incidentId: unverifiedIncidentId } }), 0);
});

test("attendance rewards require ATTENDED state and remain idempotent", async () => {
  await assert.rejects(
    prisma.$transaction((transaction) =>
      awardSessionAttendanceContribution(transaction, plannedAllocationId),
    ),
    (error: unknown) => error instanceof ApplicationError && error.code === "SESSION_ATTENDANCE_NOT_CONFIRMED",
  );

  const [first, retry] = await prisma.$transaction(async (transaction) => {
    const created = await awardSessionAttendanceContribution(transaction, attendedAllocationId);
    const duplicate = await awardSessionAttendanceContribution(transaction, attendedAllocationId);
    return [created, duplicate];
  });
  assert.equal(first.created, true);
  assert.equal(first.points, 10);
  assert.equal(retry.created, false);
  assert.equal(await prisma.contributionEvent.count({ where: { sessionAllocationId: attendedAllocationId } }), 1);
});

test("completed-event rewards derive the volunteer from an eligible participant", async () => {
  const result = await prisma.$transaction((transaction) =>
    awardCompletedEventContribution(transaction, { cleanupEventId, participantId }),
  );
  assert.equal(result.userId, userAId);
  assert.equal(result.points, 30);
  assert.equal(result.created, true);

  const response = await request(
    userAToken,
    "/api/v1/rewards/me/completed-events?limit=20",
  );
  assert.equal(response.status, 200);
  const history = (
    await response.json() as { data: CompletedCleanupEventHistoryDto }
  ).data;
  assert.equal(history.totalCount, 1);
  assert.equal(history.items.length, 1);
  assert.equal(history.items[0]?.cleanupEventId, cleanupEventId);
  assert.equal(history.items[0]?.title, "Reward cleanup event");
  assert.equal("userId" in (history.items[0] ?? {}), false);

  const otherHistoryResponse = await request(
    userBToken,
    "/api/v1/rewards/me/completed-events?limit=20",
  );
  const otherHistory = (
    await otherHistoryResponse.json() as {
      data: CompletedCleanupEventHistoryDto;
    }
  ).data;
  assert.equal(otherHistory.totalCount, 0);
  assert.deepEqual(otherHistory.items, []);
  assert.equal(
    (
      await request(
        userAToken,
        "/api/v1/rewards/me/completed-events?cursor=invalid",
      )
    ).status,
    400,
  );
});

test("approved special contributions use a stable source key for retries", async () => {
  const input = {
    recipientUserId: userAId,
    approvedByUserId: userBId,
    approvalSourceKey: `support-case:${randomUUID()}`,
  };
  const [first, retry] = await Promise.all([
    prisma.$transaction((transaction) =>
      awardApprovedSpecialContribution(transaction, input),
    ),
    prisma.$transaction((transaction) =>
      awardApprovedSpecialContribution(transaction, input),
    ),
  ]);
  assert.deepEqual(
    [first.created, retry.created].sort(),
    [false, true],
  );
  assert.equal(first.contributionId, retry.contributionId);
});

test("users receive only their own privacy-safe summary and history", async () => {
  await prisma.$transaction(async (transaction) => {
    await awardApprovedSpecialContribution(transaction, {
      recipientUserId: userAId,
      approvedByUserId: userBId,
      approvalSourceKey: `private-a:${randomUUID()}`,
    });
    await awardApprovedSpecialContribution(transaction, {
      recipientUserId: userBId,
      approvedByUserId: userBId,
      approvalSourceKey: `private-b:${randomUUID()}`,
    });
  });

  const summaryResponse = await request(userAToken, "/api/v1/rewards/me/summary");
  assert.equal(summaryResponse.status, 200);
  const summary = (await summaryResponse.json() as { data: ImpactSummaryDto }).data;
  assert.equal(summary.totalPoints, 25);
  assert.equal(summary.contributionCount, 1);

  const historyResponse = await request(userAToken, "/api/v1/rewards/me/contributions?limit=1");
  assert.equal(historyResponse.status, 200);
  const history = (await historyResponse.json() as { data: ContributionPageDto }).data;
  assert.equal(history.items.length, 1);
  assert.equal(history.items[0]?.type, ContributionType.SPECIAL_CONTRIBUTION);
  assert.equal("userId" in (history.items[0] ?? {}), false);
  assert.equal("sourceKey" in (history.items[0] ?? {}), false);
  assert.equal("recordedByUserId" in (history.items[0] ?? {}), false);
  assert.equal((await request(userAToken, "/api/v1/rewards/me/contributions?cursor=invalid")).status, 400);
});

test("earning points never changes CASL permissions", async () => {
  const beforeAbility = buildAbilityForRequest({ profile: profileA });
  await prisma.$transaction((transaction) =>
    awardApprovedSpecialContribution(transaction, {
      recipientUserId: userAId,
      approvedByUserId: userBId,
      approvalSourceKey: `ability:${randomUUID()}`,
    }),
  );
  const afterAbility = buildAbilityForRequest({ profile: profileA });

  assert.equal(beforeAbility.can(Actions.ReadOwn, Subjects.Contribution), true);
  assert.equal(afterAbility.can(Actions.ReadOwn, Subjects.Contribution), true);
  assert.equal(beforeAbility.can(Actions.Review, Subjects.IncidentReview), false);
  assert.equal(afterAbility.can(Actions.Review, Subjects.IncidentReview), false);
});
