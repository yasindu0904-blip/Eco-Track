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
} from "../authorization/authorization.types.js";
import { Subjects } from "../authorization/subjects.js";
import { abilityMiddleware } from "../middleware/ability.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { errorMiddleware } from "../middleware/error.middleware.js";
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

const activeUser: AuthenticatedUserProfile = {
  id: userId,
  email: "user@example.com",
  fullName: "Test User",
  phoneNumber: null,
  profileCompletedAt: null,
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

async function readJson(
  response: globalThis.Response,
): Promise<unknown> {
  return response.json();
}

test(
  "an active user receives citizen permissions only",
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
  "an active Super Admin receives platform review permissions",
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
