import assert from "node:assert/strict";
import type { Server } from "node:http";
import { afterEach, test } from "node:test";

import { createApp } from "../app.js";

import type {
  AuthenticatedUserProfile,
  AuthenticationDependencies,
} from "../modules/auth/auth.types.js";

const activeUser: AuthenticatedUserProfile = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "user@example.com",
  fullName: "Test User",
  phoneNumber: null,
  profileCompletedAt: null,
  platformRole: "USER",
  accountStatus: "ACTIVE",
  activeMemberships: [],
};

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

function createFakeDependencies(
  profile: AuthenticatedUserProfile = activeUser,
): AuthenticationDependencies {
  return {
    verifyAccessToken: async (accessToken) => {
      if (accessToken !== "valid-token") {
        return null;
      }

      return {
        authUserId:
          "20000000-0000-4000-8000-000000000001",
        email: profile.email,
      };
    },

    provisionOrSynchronizeProfile: async () =>
      profile,
  };
}

async function startTestServer(
  dependencies: AuthenticationDependencies =
    createFakeDependencies(),
): Promise<string> {
  const app = createApp(dependencies);

  const server = app.listen(
    0,
    "127.0.0.1",
  );

  runningServers.add(server);

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error(
      "The test server did not receive a TCP port.",
    );
  }

  return `http://127.0.0.1:${address.port}`;
}

async function readJson(
  response: Response,
): Promise<unknown> {
  return response.json();
}

test("GET /health is public", async () => {
  const baseUrl = await startTestServer();

  const response = await fetch(
    `${baseUrl}/health`,
  );

  assert.equal(response.status, 200);

  assert.deepEqual(await readJson(response), {
    status: "ok",
    service: "ecotrack-backend",
  });
});

test(
  "GET /api/v1/auth/me rejects a missing token",
  async () => {
    const baseUrl = await startTestServer();

    const response = await fetch(
      `${baseUrl}/api/v1/auth/me`,
    );

    assert.equal(response.status, 401);

    assert.deepEqual(await readJson(response), {
      error: {
        code: "AUTH_TOKEN_MISSING",
        message:
          "A valid Bearer access token is required.",
      },
    });
  },
);

test(
  "GET /api/v1/auth/me rejects an invalid token",
  async () => {
    const baseUrl = await startTestServer();

    const response = await fetch(
      `${baseUrl}/api/v1/auth/me`,
      {
        headers: {
          authorization:
            "Bearer invalid-token",
        },
      },
    );

    assert.equal(response.status, 401);

    assert.deepEqual(await readJson(response), {
      error: {
        code: "AUTH_TOKEN_INVALID",
        message:
          "The access token is invalid or expired.",
      },
    });
  },
);

test(
  "GET /api/v1/auth/me returns safe profile fields",
  async () => {
    const baseUrl = await startTestServer();

    const response = await fetch(
      `${baseUrl}/api/v1/auth/me`,
      {
        headers: {
          authorization: "Bearer valid-token",
        },
      },
    );

    const body = await readJson(response);

    assert.equal(response.status, 200);

    assert.deepEqual(body, {
      data: activeUser,
    });

    assert.equal(
      JSON.stringify(body).includes(
        "authUserId",
      ),
      false,
    );
  },
);

test(
  "GET /api/v1/auth/me returns active accepted organization memberships",
  async () => {
    const organizationMember: AuthenticatedUserProfile = {
      ...activeUser,
      activeMemberships: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          organizationId:
            "30000000-0000-4000-8000-000000000001",
          organizationName: "Green Colombo",
          organizationSlug: "green-colombo",
          role: "ORG_ADMIN",
          status: "ACTIVE",
        },
      ],
    };

    const baseUrl = await startTestServer(
      createFakeDependencies(organizationMember),
    );

    const response = await fetch(
      `${baseUrl}/api/v1/auth/me`,
      {
        headers: {
          authorization: "Bearer valid-token",
        },
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await readJson(response), {
      data: organizationMember,
    });
  },
);

//next test

test(
  "GET /api/v1/auth/me rejects an inactive account",
  async () => {
    const suspendedUser: AuthenticatedUserProfile = {
      ...activeUser,
      accountStatus: "SUSPENDED",
    };

    const baseUrl = await startTestServer(
      createFakeDependencies(suspendedUser),
    );

    const response = await fetch(
      `${baseUrl}/api/v1/auth/me`,
      {
        headers: {
          authorization: "Bearer valid-token",
        },
      },
    );

    assert.equal(response.status, 403);

    assert.deepEqual(await readJson(response), {
      error: {
        code: "ACCOUNT_INACTIVE",
        message:
          "This EcoTrack account is not active.",
      },
    });
  },
);

test(
  "a normal user cannot access the Super Admin endpoint",
  async () => {
    const completedUser: AuthenticatedUserProfile = {
      ...activeUser,
      phoneNumber: "+94770000004",
      profileCompletedAt: new Date(),
    };

    const baseUrl = await startTestServer(
      createFakeDependencies(completedUser),
    );

    const response = await fetch(
      `${baseUrl}/api/v1/super-admin/ping`,
      {
        headers: {
          authorization: "Bearer valid-token",
        },
      },
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
  "an incomplete profile cannot bypass onboarding through a protected endpoint",
  async () => {
    const incompleteSuperAdmin: AuthenticatedUserProfile = {
      ...activeUser,
      platformRole: "SUPER_ADMIN",
    };

    const baseUrl = await startTestServer(
      createFakeDependencies(incompleteSuperAdmin),
    );

    const response = await fetch(
      `${baseUrl}/api/v1/super-admin/ping`,
      {
        headers: {
          authorization: "Bearer valid-token",
        },
      },
    );

    assert.equal(response.status, 403);
    assert.deepEqual(await readJson(response), {
      error: {
        code: "PROFILE_INCOMPLETE",
        message:
          "Complete your profile before using this EcoTrack feature.",
      },
    });
  },
);

test(
  "an active Super Admin can access the Super Admin endpoint",
  async () => {
    const activeSuperAdmin:
      AuthenticatedUserProfile = {
        ...activeUser,
        id: "10000000-0000-4000-8000-000000000002",
        email: "superadmin@example.com",
        fullName: "Test Super Admin",
        phoneNumber: "+94770000005",
        profileCompletedAt: new Date(),
        platformRole: "SUPER_ADMIN",
      };

    const baseUrl = await startTestServer(
      createFakeDependencies(activeSuperAdmin),
    );

    const response = await fetch(
      `${baseUrl}/api/v1/super-admin/ping`,
      {
        headers: {
          authorization: "Bearer valid-token",
        },
      },
    );

    assert.equal(response.status, 200);

    assert.deepEqual(await readJson(response), {
      data: {
        message:
          "Super Admin access confirmed.",
      },
    });
  },
);


//next test


test(
  "a malformed Authorization header is rejected",
  async () => {
    const baseUrl = await startTestServer();

    const response = await fetch(
      `${baseUrl}/api/v1/auth/me`,
      {
        headers: {
          authorization: "Basic invalid-value",
        },
      },
    );

    assert.equal(response.status, 401);

    assert.deepEqual(await readJson(response), {
      error: {
        code: "AUTH_TOKEN_MISSING",
        message:
          "A valid Bearer access token is required.",
      },
    });
  },
);

test(
  "unexpected authentication errors return a safe response",
  async () => {
    const dependencies =
      createFakeDependencies();

    dependencies.verifyAccessToken =
      async () => {
        throw new Error(
          "Private Supabase failure details",
        );
      };

    const baseUrl =
      await startTestServer(dependencies);

    const originalConsoleError =
      console.error;

    console.error = () => undefined;

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/auth/me`,
        {
          headers: {
            authorization:
              "Bearer valid-token",
          },
        },
      );

      const body = await readJson(response);

      assert.equal(response.status, 500);

      assert.deepEqual(body, {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message:
            "An unexpected error occurred.",
        },
      });

      assert.equal(
        JSON.stringify(body).includes(
          "Private Supabase failure details",
        ),
        false,
      );
    } finally {
      console.error = originalConsoleError;
    }
  },
);

test(
  "an unknown route returns a consistent 404 response",
  async () => {
    const baseUrl = await startTestServer();

    const response = await fetch(
      `${baseUrl}/api/v1/unknown-route`,
    );

    assert.equal(response.status, 404);

    assert.deepEqual(await readJson(response), {
      error: {
        code: "ROUTE_NOT_FOUND",
        message:
          "The requested route was not found.",
      },
    });
  },
);
