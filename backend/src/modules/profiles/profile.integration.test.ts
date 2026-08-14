import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import test from "node:test";

import { createApp } from "../../app.js";
import { prisma } from "../../database/prisma.js";
import type { AuthenticationDependencies } from "../auth/auth.types.js";

test("a first-time user completes name and phone only once", async () => {
  const id = randomUUID();
  const authUserId = randomUUID();
  const email = `${id}@example.test`;
  let server: Server | null = null;

  try {
    await prisma.userProfile.create({ data: { id, authUserId, email } });

    const dependencies: AuthenticationDependencies = {
      verifyAccessToken: async (token) =>
        token === "valid-token" ? { authUserId, email } : null,
      provisionOrSynchronizeProfile: async () => {
        const profile = await prisma.userProfile.findUniqueOrThrow({
          where: { id },
        });

        return {
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName,
          phoneNumber: profile.phoneNumber,
          profileCompletedAt: profile.profileCompletedAt,
          platformRole: profile.platformRole,
          accountStatus: profile.accountStatus,
        };
      },
    };

    server = createApp(dependencies).listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      server?.once("listening", resolve);
      server?.once("error", reject);
    });

    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
    const headers = {
      authorization: "Bearer valid-token",
      "content-type": "application/json",
    };

    const firstSignIn = await fetch(`${baseUrl}/auth/me`, { headers });
    const firstSignInBody = (await firstSignIn.json()) as {
      data: { profileCompletedAt: string | null };
    };
    assert.equal(firstSignIn.status, 200);
    assert.equal(firstSignInBody.data.profileCompletedAt, null);

    const invalid = await fetch(`${baseUrl}/profile/complete`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ fullName: "Eco Citizen", phoneNumber: "bad" }),
    });
    assert.equal(invalid.status, 400);

    const completed = await fetch(`${baseUrl}/profile/complete`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        fullName: "Eco Citizen",
        phoneNumber: "+94771234567",
      }),
    });
    assert.equal(completed.status, 200);

    const nextSignIn = await fetch(`${baseUrl}/auth/me`, { headers });
    const nextSignInBody = (await nextSignIn.json()) as {
      data: {
        fullName: string | null;
        phoneNumber: string | null;
        profileCompletedAt: string | null;
      };
    };
    assert.equal(nextSignIn.status, 200);
    assert.equal(nextSignInBody.data.fullName, "Eco Citizen");
    assert.equal(nextSignInBody.data.phoneNumber, "+94771234567");
    assert.ok(nextSignInBody.data.profileCompletedAt);
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
    }

    await prisma.userProfile.deleteMany({ where: { id } });
  }
});
