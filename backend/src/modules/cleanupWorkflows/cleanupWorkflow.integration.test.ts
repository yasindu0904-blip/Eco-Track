import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

import { createApp } from "../../app.js";
import { authorizationDependencies } from "../../authorization/authorization.dependencies.js";
import { prisma } from "../../database/prisma.js";
import { ApplicationError } from "../../errors/applicationError.js";
import { AccountStatus, MembershipRole, MembershipSource, MembershipStatus, OrganizationStatus, PlatformRole } from "../../generated/prisma/enums.js";
import type { AuthenticationDependencies, AuthenticatedUserProfile } from "../auth/auth.types.js";
import { cleanupWorkflowDependencies } from "./cleanupWorkflow.dependencies.js";
import { initializeAndGetCleanupWorkflow, requireAllowedCleanupWorkflowTransition } from "./services/cleanupWorkflow.service.js";

const profileAId = randomUUID();
const profileBId = randomUUID();
const authUserAId = randomUUID();
const authUserBId = randomUUID();
const organizationAId = randomUUID();
const organizationBId = randomUUID();
const tokenA = `workflow-a-${profileAId}`;
const tokenB = `workflow-b-${profileBId}`;

function profile(id: string, email: string): AuthenticatedUserProfile {
  return {
    id,
    email,
    fullName: "Workflow Test Admin",
    phoneNumber: "+94770000001",
    profileCompletedAt: new Date(),
    platformRole: PlatformRole.USER,
    accountStatus: AccountStatus.ACTIVE,
  };
}

const profileA = profile(profileAId, `workflow-a-${profileAId}@example.com`);
const profileB = profile(profileBId, `workflow-b-${profileBId}@example.com`);

const authenticationDependencies: AuthenticationDependencies = {
  async verifyAccessToken(accessToken) {
    if (accessToken === tokenA) return { authUserId: authUserAId, email: profileA.email };
    if (accessToken === tokenB) return { authUserId: authUserBId, email: profileB.email };
    return null;
  },
  async provisionOrSynchronizeProfile(identity) {
    return identity.authUserId === authUserAId ? profileA : profileB;
  },
};

let server: Server | undefined;
let baseUrl = "";

before(async () => {
  await prisma.userProfile.createMany({
    data: [
      { id: profileAId, authUserId: authUserAId, email: profileA.email, fullName: profileA.fullName, phoneNumber: profileA.phoneNumber, profileCompletedAt: profileA.profileCompletedAt },
      { id: profileBId, authUserId: authUserBId, email: profileB.email, fullName: profileB.fullName, phoneNumber: profileB.phoneNumber, profileCompletedAt: profileB.profileCompletedAt },
    ],
  });

  await prisma.organization.createMany({
    data: [
      { id: organizationAId, requestedByUserId: profileAId, name: "Workflow Test Organization A", slug: `workflow-a-${organizationAId}`, officialEmail: `org-a-${organizationAId}@example.com`, officialPhone: "+94770000011", officialAddress: "Test address A", status: OrganizationStatus.ACTIVE },
      { id: organizationBId, requestedByUserId: profileBId, name: "Workflow Test Organization B", slug: `workflow-b-${organizationBId}`, officialEmail: `org-b-${organizationBId}@example.com`, officialPhone: "+94770000012", officialAddress: "Test address B", status: OrganizationStatus.ACTIVE },
    ],
  });

  await prisma.organizationMembership.createMany({
    data: [
      { organizationId: organizationAId, userId: profileAId, role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE, source: MembershipSource.FIRST_ADMIN },
      { organizationId: organizationBId, userId: profileBId, role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE, source: MembershipSource.FIRST_ADMIN },
    ],
  });

  const app = createApp(authenticationDependencies, {
    authorizationDependencies,
    cleanupWorkflowDependencies,
  });
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", () => resolve()); });
  if (!server) throw new Error("The cleanup-workflow test server did not start.");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
  await prisma.organizationMembership.deleteMany({ where: { organizationId: { in: [organizationAId, organizationBId] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [organizationAId, organizationBId] } } });
  await prisma.userProfile.deleteMany({ where: { id: { in: [profileAId, profileBId] } } });
  await prisma.$disconnect();
});

test("default workflow initialization is idempotent", async () => {
  await initializeAndGetCleanupWorkflow(cleanupWorkflowDependencies, organizationAId);
  await initializeAndGetCleanupWorkflow(cleanupWorkflowDependencies, organizationAId);
  assert.equal(await prisma.cleanupWorkflowStatus.count({ where: { organizationId: organizationAId } }), 7);
  assert.equal(await prisma.cleanupWorkflowTransition.count({ where: { organizationId: organizationAId } }), 10);
});

test("an existing organization with missing protected defaults is safely repaired", async () => {
  await prisma.cleanupWorkflowStatus.deleteMany({
    where: { organizationId: organizationAId, mappedLifecycleStatus: { in: ["DRAFT", "COMPLETED"] } },
  });
  const workflow = await initializeAndGetCleanupWorkflow(cleanupWorkflowDependencies, organizationAId);
  const draft = workflow.statuses.find((status) => status.mappedLifecycleStatus === "DRAFT");
  const completed = workflow.statuses.find((status) => status.mappedLifecycleStatus === "COMPLETED");
  assert.equal(draft?.isInitial, true);
  assert.equal(draft?.isActive, true);
  assert.equal(completed?.isFinal, true);
  assert.equal(completed?.isActive, true);
  assert.equal(workflow.transitions.length, 10);
});

test("protected lifecycle flags are repaired without replacing custom codes and labels", async () => {
  const statuses = await prisma.cleanupWorkflowStatus.findMany({
    where: {
      organizationId: organizationAId,
      mappedLifecycleStatus: { in: ["DRAFT", "COMPLETED", "CANCELLED"] },
    },
  });
  const draft = statuses.find((status) => status.mappedLifecycleStatus === "DRAFT");
  const completed = statuses.find((status) => status.mappedLifecycleStatus === "COMPLETED");
  const cancelled = statuses.find((status) => status.mappedLifecycleStatus === "CANCELLED");
  assert.ok(draft && completed && cancelled);

  await Promise.all([
    prisma.cleanupWorkflowStatus.update({
      where: { id: draft.id },
      data: { code: "PLANNING", label: "Planning", isInitial: false, isActive: false },
    }),
    prisma.cleanupWorkflowStatus.update({
      where: { id: completed.id },
      data: { code: "FINISHED", label: "Work Finished", isFinal: false, isActive: false },
    }),
    prisma.cleanupWorkflowStatus.update({
      where: { id: cancelled.id },
      data: { code: "STOPPED", label: "Event Stopped", isFinal: false, isActive: false },
    }),
  ]);

  const workflow = await initializeAndGetCleanupWorkflow(cleanupWorkflowDependencies, organizationAId);
  const repairedDraft = workflow.statuses.find((status) => status.mappedLifecycleStatus === "DRAFT");
  const repairedCompleted = workflow.statuses.find((status) => status.mappedLifecycleStatus === "COMPLETED");
  const repairedCancelled = workflow.statuses.find((status) => status.mappedLifecycleStatus === "CANCELLED");

  assert.deepEqual(
    {
      code: repairedDraft?.code,
      label: repairedDraft?.label,
      isInitial: repairedDraft?.isInitial,
      isActive: repairedDraft?.isActive,
      isFinal: repairedDraft?.isFinal,
    },
    { code: "PLANNING", label: "Planning", isInitial: true, isActive: true, isFinal: false },
  );
  assert.deepEqual(
    {
      code: repairedCompleted?.code,
      label: repairedCompleted?.label,
      isInitial: repairedCompleted?.isInitial,
      isActive: repairedCompleted?.isActive,
      isFinal: repairedCompleted?.isFinal,
    },
    { code: "FINISHED", label: "Work Finished", isInitial: false, isActive: true, isFinal: true },
  );
  assert.deepEqual(
    {
      code: repairedCancelled?.code,
      label: repairedCancelled?.label,
      isInitial: repairedCancelled?.isInitial,
      isActive: repairedCancelled?.isActive,
      isFinal: repairedCancelled?.isFinal,
    },
    { code: "STOPPED", label: "Event Stopped", isInitial: false, isActive: true, isFinal: true },
  );
});

test("the real route lists only the verified active tenant workflow", async () => {
  const ownResponse = await fetch(`${baseUrl}/api/v1/organizations/${organizationAId}/cleanup-workflow`, { headers: { authorization: `Bearer ${tokenA}` } });
  assert.equal(ownResponse.status, 200);
  const ownBody = await ownResponse.json() as { data: { organizationId: string; statuses: unknown[] } };
  assert.equal(ownBody.data.organizationId, organizationAId);
  assert.equal(ownBody.data.statuses.length, 7);

  const crossTenantResponse = await fetch(`${baseUrl}/api/v1/organizations/${organizationBId}/cleanup-workflow`, { headers: { authorization: `Bearer ${tokenA}` } });
  assert.equal(crossTenantResponse.status, 403);
  assert.equal((await crossTenantResponse.json() as { error: { code: string } }).error.code, "ORGANIZATION_ACCESS_DENIED");
});

test("configured transitions are tenant-bound and direct cross-organization IDs fail", async () => {
  const [workflowA, workflowB] = await Promise.all([
    initializeAndGetCleanupWorkflow(cleanupWorkflowDependencies, organizationAId),
    initializeAndGetCleanupWorkflow(cleanupWorkflowDependencies, organizationBId),
  ]);
  const draftA = workflowA.statuses.find((status) => status.mappedLifecycleStatus === "DRAFT");
  const publishedA = workflowA.statuses.find((status) => status.mappedLifecycleStatus === "PUBLISHED");
  const completedA = workflowA.statuses.find((status) => status.mappedLifecycleStatus === "COMPLETED");
  const publishedB = workflowB.statuses.find((status) => status.mappedLifecycleStatus === "PUBLISHED");
  assert.ok(draftA && publishedA && completedA && publishedB);

  const allowed = await requireAllowedCleanupWorkflowTransition(cleanupWorkflowDependencies, organizationAId, draftA.id, publishedA.id);
  assert.equal(allowed.organizationId, organizationAId);

  await assert.rejects(
    requireAllowedCleanupWorkflowTransition(cleanupWorkflowDependencies, organizationAId, draftA.id, publishedB.id),
    (error: unknown) => error instanceof ApplicationError && error.statusCode === 409 && error.code === "CLEANUP_WORKFLOW_TRANSITION_NOT_ALLOWED",
  );

  await assert.rejects(
    requireAllowedCleanupWorkflowTransition(cleanupWorkflowDependencies, organizationAId, draftA.id, completedA.id),
    (error: unknown) => error instanceof ApplicationError && error.statusCode === 409 && error.code === "CLEANUP_WORKFLOW_TRANSITION_NOT_ALLOWED",
  );
});
