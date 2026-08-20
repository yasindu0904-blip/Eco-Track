import assert from "node:assert/strict";
import type { Server } from "node:http";
import { afterEach, test } from "node:test";

import { subject } from "@casl/ability";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { Actions } from "../authorization/actions.js";
import { buildAbilityForRequest } from "../authorization/ability.factory.js";
import type {
  ActiveTenantContext,
  AuthorizationDependencies,
  EventAuthorizationContext,
} from "../authorization/authorization.types.js";
import {
  createAuthorizationSubject,
  Subjects,
} from "../authorization/subjects.js";
import { abilityMiddleware } from "../middleware/ability.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { errorMiddleware } from "../middleware/error.middleware.js";
import { createEventAuthorizationMiddleware } from "../middleware/eventAuthorization.middleware.js";
import { createTenantMiddleware } from "../middleware/tenant.middleware.js";
import type { AuthenticatedUserProfile } from "../modules/auth/auth.types.js";

const userId =
  "10000000-0000-4000-8000-000000000001";
const authUserId =
  "20000000-0000-4000-8000-000000000001";
const organizationAId =
  "30000000-0000-4000-8000-000000000001";
const organizationBId =
  "30000000-0000-4000-8000-000000000002";
const membershipId =
  "40000000-0000-4000-8000-000000000001";
const cleanupEventAId =
  "50000000-0000-4000-8000-000000000001";
const cleanupEventBId =
  "50000000-0000-4000-8000-000000000002";

const activeUser: AuthenticatedUserProfile = {
  id: userId,
  email: "user@example.com",
  fullName: "Test User",
  phoneNumber: "+94770000001",
  profileCompletedAt: new Date(),
  platformRole: "USER",
  accountStatus: "ACTIVE",
};

function createTenantContext(
  role: "ORG_MEMBER" | "ORG_ADMIN",
): ActiveTenantContext {
  return {
    organization: {
      id: organizationAId,
      status: "ACTIVE",
    },
    membership: {
      id: membershipId,
      organizationId: organizationAId,
      userId,
      role,
      status: "ACTIVE",
    },
  };
}

const runningServers = new Set<Server>();

afterEach(async () => {
  await Promise.all(
    [...runningServers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            runningServers.delete(server);

            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    ),
  );
});

function attachAuthentication(
  profile: AuthenticatedUserProfile,
) {
  return function authenticateForTest(
    request: Request,
    _response: Response,
    next: NextFunction,
  ): void {
    request.authentication = {
      authUserId,
      profile,
    };

    next();
  };
}

function createFakeAuthorizationDependencies(
  tenant: ActiveTenantContext | null,
  eventAuthorization:
    | EventAuthorizationContext
    | null = null,
): AuthorizationDependencies {
  return {
    findActiveTenantContext: async (
      requestedUserId,
      requestedOrganizationId,
    ) => {
      if (
        !tenant ||
        requestedUserId !== tenant.membership.userId ||
        requestedOrganizationId !==
          tenant.organization.id
      ) {
        return null;
      }

      return tenant;
    },

    findEventAuthorizationContext: async (
      requestedOrganizationId,
      requestedMembershipId,
      requestedCleanupEventId,
    ) => {
      if (
        !tenant ||
        !eventAuthorization ||
        requestedOrganizationId !==
          tenant.organization.id ||
        requestedMembershipId !==
          tenant.membership.id ||
        requestedCleanupEventId !==
          eventAuthorization.cleanupEvent.id ||
        requestedOrganizationId !==
          eventAuthorization.cleanupEvent.organizationId
      ) {
        return null;
      }

      return eventAuthorization;
    },
  };
}

function createEventAuthorizationContext(
  isCoordinator: boolean,
): EventAuthorizationContext {
  return {
    cleanupEvent: {
      id: cleanupEventAId,
      organizationId: organizationAId,
      lifecycleStatus: "PUBLISHED",
    },
    isCoordinator,
  };
}

async function startTenantTestServer(
  dependencies: AuthorizationDependencies,
  profile: AuthenticatedUserProfile = activeUser,
): Promise<string> {
  const app = express();

  app.get(
    "/organizations/:organizationId/members",
    attachAuthentication(profile),
    createTenantMiddleware(dependencies),
    abilityMiddleware,
    authorize(
      Actions.ManageMembership,
      Subjects.OrganizationMembership,
    ),
    (_request, response) => {
      response.status(200).json({
        data: {
          message: "Membership access confirmed.",
        },
      });
    },
  );

  app.use(errorMiddleware);

  const server = app.listen(0, "127.0.0.1");

  runningServers.add(server);

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error(
      "The authorization test server did not receive a TCP port.",
    );
  }

  return `http://127.0.0.1:${address.port}`;
}

async function startEventTestServer(
  dependencies: AuthorizationDependencies,
  profile: AuthenticatedUserProfile = activeUser,
): Promise<string> {
  const app = express();

  app.get(
    "/organizations/:organizationId/events/:eventId/operations",
    attachAuthentication(profile),
    createTenantMiddleware(dependencies),
    createEventAuthorizationMiddleware(dependencies),
    abilityMiddleware,
    authorize(
      Actions.Transition,
      Subjects.CleanupEvent,
    ),
    (_request, response) => {
      response.status(200).json({
        data: {
          message: "Event operation access confirmed.",
        },
      });
    },
  );

  app.use(errorMiddleware);

  const server = app.listen(0, "127.0.0.1");

  runningServers.add(server);

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error(
      "The event authorization test server did not receive a TCP port.",
    );
  }

  return `http://127.0.0.1:${address.port}`;
}

async function readJson(
  response: globalThis.Response,
): Promise<unknown> {
  return response.json();
}

test(
  "an active completed user receives citizen and volunteer permissions",
  () => {
    const ability = buildAbilityForRequest({
      profile: activeUser,
    });

    assert.equal(
      ability.can(
        Actions.Create,
        Subjects.OrganizationApplication,
      ),
      true,
    );
    assert.equal(
      ability.can(
        Actions.ReadOwn,
        Subjects.Notification,
      ),
      true,
    );
    assert.equal(
      ability.can(Actions.Create, Subjects.Incident),
      true,
    );
    assert.equal(
      ability.can(Actions.Join, Subjects.CleanupEvent),
      true,
    );
    assert.equal(
      ability.can(
        Actions.ReadOwn,
        createAuthorizationSubject(Subjects.EventParticipant, { userId }),
      ),
      true,
    );
    assert.equal(
      ability.can(
        Actions.ReadOwn,
        createAuthorizationSubject(Subjects.EventParticipant, {
          userId: "10000000-0000-4000-8000-000000000099",
        }),
      ),
      false,
    );
    assert.equal(
      ability.can(
        Actions.ManageAvailability,
        Subjects.ParticipantAvailability,
      ),
      true,
    );
    assert.equal(
      ability.can(
        Actions.ManageAvailability,
        createAuthorizationSubject(
          Subjects.ParticipantAvailability,
          {
            participant: {
              userId,
            },
          },
        ),
      ),
      true,
    );
    assert.equal(
      ability.can(
        Actions.ManageAvailability,
        createAuthorizationSubject(
          Subjects.ParticipantAvailability,
          {
            participant: {
              userId:
                "10000000-0000-4000-8000-000000000099",
            },
          },
        ),
      ),
      false,
    );
    assert.equal(
      ability.can(Actions.Publish, Subjects.CleanupEvent),
      false,
    );
    assert.equal(
      ability.can(
        Actions.Approve,
        Subjects.OrganizationApplication,
      ),
      false,
    );
    assert.equal(
      ability.can(Actions.Read, Subjects.Platform),
      false,
    );
  },
);

test(
  "notification abilities are restricted to the authenticated user's records",
  () => {
    const ability = buildAbilityForRequest({
      profile: activeUser,
    });
    const ownNotification = createAuthorizationSubject(
      Subjects.Notification,
      {
        id: "60000000-0000-4000-8000-000000000001",
        userId,
      },
    );
    const otherNotification = createAuthorizationSubject(
      Subjects.Notification,
      {
        id: "60000000-0000-4000-8000-000000000002",
        userId:
          "10000000-0000-4000-8000-000000000002",
      },
    );

    assert.equal(
      ability.can(Actions.ReadOwn, ownNotification),
      true,
    );
    assert.equal(
      ability.can(Actions.MarkRead, ownNotification),
      true,
    );
    assert.equal(
      ability.can(Actions.ReadOwn, otherNotification),
      false,
    );
    assert.equal(
      ability.can(Actions.MarkRead, otherNotification),
      false,
    );
  },
);

test(
  "an active Super Admin receives oversight but no ordinary operations",
  () => {
    const ability = buildAbilityForRequest({
      profile: {
        ...activeUser,
        platformRole: "SUPER_ADMIN",
      },
    });

    assert.equal(
      ability.can(Actions.Read, Subjects.Platform),
      true,
    );
    assert.equal(
      ability.can(
        Actions.Review,
        Subjects.OrganizationApplication,
      ),
      true,
    );
    assert.equal(
      ability.can(
        Actions.Approve,
        Subjects.OrganizationApplication,
      ),
      true,
    );
    assert.equal(
      ability.can(
        Actions.Decline,
        Subjects.OrganizationApplication,
      ),
      true,
    );
    assert.equal(
      ability.can(
        Actions.ManageMembership,
        Subjects.OrganizationMembership,
      ),
      false,
    );
    assert.equal(
      ability.can(Actions.Read, Subjects.Incident),
      true,
    );
    assert.equal(
      ability.can(Actions.Create, Subjects.Incident),
      false,
    );
    assert.equal(
      ability.can(Actions.Join, Subjects.CleanupEvent),
      false,
    );
    assert.equal(
      ability.can(Actions.Publish, Subjects.CleanupEvent),
      false,
    );
    assert.equal(
      ability.can(
        Actions.RecordAttendance,
        Subjects.SessionAllocation,
      ),
      false,
    );
  },
);

test(
  "an incomplete profile can update itself but receives no domain permissions",
  () => {
    const ability = buildAbilityForRequest({
      profile: {
        ...activeUser,
        phoneNumber: null,
        profileCompletedAt: null,
      },
    });

    assert.equal(
      ability.can(Actions.Update, Subjects.UserProfile),
      true,
    );
    assert.equal(
      ability.can(
        Actions.Create,
        Subjects.OrganizationApplication,
      ),
      false,
    );
    assert.equal(
      ability.can(Actions.Create, Subjects.Incident),
      false,
    );
    assert.equal(
      ability.can(Actions.Join, Subjects.CleanupEvent),
      false,
    );
  },
);

test(
  "an Org Admin membership is limited to its own organization",
  () => {
    const tenant = createTenantContext("ORG_ADMIN");
    const ability = buildAbilityForRequest({
      profile: activeUser,
      tenant,
    });

    const organizationAMembership = subject(
      Subjects.OrganizationMembership,
      {
        id: membershipId,
        organizationId: organizationAId,
        userId,
        sourceRequestId: null,
        addedOrApprovedByMembershipId: null,
        role: "ORG_ADMIN" as const,
        status: "ACTIVE" as const,
        source: "FIRST_ADMIN" as const,
        joinedAt: new Date(),
        endedAt: null,
      },
    );

    const organizationBMembership = {
      ...organizationAMembership,
      id: "40000000-0000-4000-8000-000000000002",
      organizationId: organizationBId,
    };

    assert.equal(
      ability.can(
        Actions.ManageMembership,
        organizationAMembership,
      ),
      true,
    );
    assert.equal(
      ability.can(
        Actions.ManageMembership,
        organizationBMembership,
      ),
      false,
    );

    const organizationAEvent =
      createAuthorizationSubject(
        Subjects.CleanupEvent,
        {
          id: cleanupEventAId,
          organizationId: organizationAId,
        },
      );
    const organizationBEvent =
      createAuthorizationSubject(
        Subjects.CleanupEvent,
        {
          id: cleanupEventBId,
          organizationId: organizationBId,
        },
      );

    assert.equal(
      ability.can(Actions.Publish, organizationAEvent),
      true,
    );
    assert.equal(
      ability.can(Actions.Publish, organizationBEvent),
      false,
    );

    const organizationASession = createAuthorizationSubject(
      Subjects.EventSession,
      {
        id: "50000000-0000-4000-8000-000000000001",
        cleanupEventId: cleanupEventAId,
        cleanupEvent: { organizationId: organizationAId },
      },
    );
    const organizationBSession = createAuthorizationSubject(
      Subjects.EventSession,
      {
        id: "50000000-0000-4000-8000-000000000002",
        cleanupEventId: cleanupEventBId,
        cleanupEvent: { organizationId: organizationBId },
      },
    );

    assert.equal(
      ability.can(Actions.Transition, organizationASession),
      true,
    );
    assert.equal(
      ability.can(Actions.Transition, organizationBSession),
      false,
    );
  },
);

test(
  "a suspended profile receives no protected permissions",
  () => {
    const ability = buildAbilityForRequest({
      profile: {
        ...activeUser,
        accountStatus: "SUSPENDED",
      },
      tenant: createTenantContext("ORG_ADMIN"),
    });

    assert.equal(
      ability.can(
        Actions.Create,
        Subjects.OrganizationApplication,
      ),
      false,
    );
    assert.equal(
      ability.can(Actions.Read, Subjects.Platform),
      false,
    );
    assert.equal(
      ability.can(
        Actions.ManageMembership,
        Subjects.OrganizationMembership,
      ),
      false,
    );
  },
);

test(
  "an archived profile receives no protected permissions",
  () => {
    const ability = buildAbilityForRequest({
      profile: {
        ...activeUser,
        accountStatus: "ARCHIVED",
      },
      tenant: createTenantContext("ORG_ADMIN"),
    });

    assert.equal(
      ability.can(Actions.Update, Subjects.UserProfile),
      false,
    );
    assert.equal(
      ability.can(Actions.Create, Subjects.Incident),
      false,
    );
    assert.equal(
      ability.can(Actions.Publish, Subjects.CleanupEvent),
      false,
    );
  },
);

test(
  "an assigned Org Member coordinator receives only event-scoped operations",
  () => {
    const tenant = createTenantContext("ORG_MEMBER");
    const ability = buildAbilityForRequest({
      profile: activeUser,
      tenant,
      eventAuthorization:
        createEventAuthorizationContext(true),
    });

    const assignedEvent = createAuthorizationSubject(
      Subjects.CleanupEvent,
      {
        id: cleanupEventAId,
        organizationId: organizationAId,
      },
    );
    const otherEvent = createAuthorizationSubject(
      Subjects.CleanupEvent,
      {
        id: cleanupEventBId,
        organizationId: organizationAId,
      },
    );

    assert.equal(
      ability.can(Actions.Transition, assignedEvent),
      true,
    );
    assert.equal(
      ability.can(Actions.Complete, assignedEvent),
      true,
    );
    assert.equal(
      ability.can(Actions.Transition, otherEvent),
      false,
    );
    assert.equal(
      ability.can(Actions.Publish, assignedEvent),
      false,
    );
    assert.equal(
      ability.can(Actions.Cancel, assignedEvent),
      false,
    );
    assert.equal(
      ability.can(
        Actions.ManageMembership,
        Subjects.OrganizationMembership,
      ),
      false,
    );
    assert.equal(
      ability.can(
        Actions.RecordAttendance,
        createAuthorizationSubject(
          Subjects.SessionAllocation,
          {
            participant: {
              cleanupEventId: cleanupEventAId,
            },
          },
        ),
      ),
      true,
    );
    assert.equal(
      ability.can(
        Actions.RecordAttendance,
        createAuthorizationSubject(
          Subjects.SessionAllocation,
          {
            participant: {
              cleanupEventId: cleanupEventBId,
            },
          },
        ),
      ),
      false,
    );
  },
);

test(
  "an ordinary Org Member receives no event operation permissions",
  () => {
    const ability = buildAbilityForRequest({
      profile: activeUser,
      tenant: createTenantContext("ORG_MEMBER"),
      eventAuthorization:
        createEventAuthorizationContext(false),
    });

    assert.equal(
      ability.can(
        Actions.Transition,
        Subjects.CleanupEvent,
      ),
      false,
    );
    assert.equal(
      ability.can(
        Actions.RecordAttendance,
        Subjects.SessionAllocation,
      ),
      false,
    );
  },
);

test(
  "an Org Admin can enter their own organization membership route",
  async () => {
    const baseUrl = await startTenantTestServer(
      createFakeAuthorizationDependencies(
        createTenantContext("ORG_ADMIN"),
      ),
    );

    const response = await fetch(
      `${baseUrl}/organizations/${organizationAId}/members`,
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await readJson(response), {
      data: {
        message: "Membership access confirmed.",
      },
    });
  },
);

test(
  "changing the route ID cannot grant cross-organization access",
  async () => {
    const baseUrl = await startTenantTestServer(
      createFakeAuthorizationDependencies(
        createTenantContext("ORG_ADMIN"),
      ),
    );

    const response = await fetch(
      `${baseUrl}/organizations/${organizationBId}/members`,
    );

    assert.equal(response.status, 403);
    assert.deepEqual(await readJson(response), {
      error: {
        code: "ORGANIZATION_ACCESS_DENIED",
        message:
          "You do not have access to this organization.",
      },
    });
  },
);

test(
  "an Org Member cannot manage organization memberships",
  async () => {
    const baseUrl = await startTenantTestServer(
      createFakeAuthorizationDependencies(
        createTenantContext("ORG_MEMBER"),
      ),
    );

    const response = await fetch(
      `${baseUrl}/organizations/${organizationAId}/members`,
    );

    assert.equal(response.status, 403);
    assert.deepEqual(await readJson(response), {
      error: {
        code: "AUTHORIZATION_DENIED",
        message:
          "You do not have permission to perform this action.",
      },
    });
  },
);

test(
  "tenant middleware rejects a malformed organization ID",
  async () => {
    const baseUrl = await startTenantTestServer(
      createFakeAuthorizationDependencies(
        createTenantContext("ORG_ADMIN"),
      ),
    );

    const response = await fetch(
      `${baseUrl}/organizations/not-a-uuid/members`,
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await readJson(response), {
      error: {
        code: "ORGANIZATION_ID_INVALID",
        message:
          "A valid organization ID is required.",
      },
    });
  },
);

test(
  "an assigned coordinator can enter only the verified event route",
  async () => {
    const tenant = createTenantContext("ORG_MEMBER");
    const baseUrl = await startEventTestServer(
      createFakeAuthorizationDependencies(
        tenant,
        createEventAuthorizationContext(true),
      ),
    );

    const response = await fetch(
      `${baseUrl}/organizations/${organizationAId}/events/${cleanupEventAId}/operations`,
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await readJson(response), {
      data: {
        message: "Event operation access confirmed.",
      },
    });
  },
);

test(
  "an ordinary Org Member cannot gain coordinator operations",
  async () => {
    const tenant = createTenantContext("ORG_MEMBER");
    const baseUrl = await startEventTestServer(
      createFakeAuthorizationDependencies(
        tenant,
        createEventAuthorizationContext(false),
      ),
    );

    const response = await fetch(
      `${baseUrl}/organizations/${organizationAId}/events/${cleanupEventAId}/operations`,
    );

    assert.equal(response.status, 403);
    assert.deepEqual(await readJson(response), {
      error: {
        code: "AUTHORIZATION_DENIED",
        message:
          "You do not have permission to perform this action.",
      },
    });
  },
);

test(
  "changing the event ID cannot grant access to another event",
  async () => {
    const tenant = createTenantContext("ORG_MEMBER");
    const baseUrl = await startEventTestServer(
      createFakeAuthorizationDependencies(
        tenant,
        createEventAuthorizationContext(true),
      ),
    );

    const response = await fetch(
      `${baseUrl}/organizations/${organizationAId}/events/${cleanupEventBId}/operations`,
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await readJson(response), {
      error: {
        code: "CLEANUP_EVENT_NOT_FOUND",
        message:
          "The cleanup event was not found in this organization.",
      },
    });
  },
);

test(
  "event authorization middleware rejects a malformed event ID",
  async () => {
    const tenant = createTenantContext("ORG_MEMBER");
    const baseUrl = await startEventTestServer(
      createFakeAuthorizationDependencies(
        tenant,
        createEventAuthorizationContext(true),
      ),
    );

    const response = await fetch(
      `${baseUrl}/organizations/${organizationAId}/events/not-a-uuid/operations`,
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await readJson(response), {
      error: {
        code: "CLEANUP_EVENT_ID_INVALID",
        message:
          "A valid cleanup event ID is required.",
      },
    });
  },
);
