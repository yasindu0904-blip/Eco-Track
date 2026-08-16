import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../../database/prisma.js";
import { upsertAuthenticationProfile } from "./repositories/auth.repository.js";

test("authentication exposes only memberships in active organizations", async () => {
  const userId = randomUUID();
  const authUserId = randomUUID();
  const organizationId = randomUUID();
  const email = `${userId}@example.test`;

  try {
    await prisma.userProfile.create({
      data: {
        id: userId,
        authUserId,
        email,
        fullName: "Organization Admin",
        phoneNumber: "+94770000001",
        profileCompletedAt: new Date(),
      },
    });

    await prisma.organization.create({
      data: {
        id: organizationId,
        requestedByUserId: userId,
        name: "Active Eco Group",
        slug: `active-eco-group-${organizationId}`,
        officialEmail: email,
        officialPhone: "+94770000002",
        officialAddress: "Colombo, Sri Lanka",
        status: "ACTIVE",
        memberships: {
          create: {
            userId,
            role: "ORG_ADMIN",
            status: "ACTIVE",
            source: "FIRST_ADMIN",
          },
        },
      },
    });

    const activeProfile = await upsertAuthenticationProfile({
      authUserId,
      email,
    });

    assert.deepEqual(activeProfile.activeMemberships, [
      {
        id: activeProfile.activeMemberships?.[0]?.id,
        organizationId,
        organizationName: "Active Eco Group",
        organizationSlug: `active-eco-group-${organizationId}`,
        role: "ORG_ADMIN",
        status: "ACTIVE",
      },
    ]);

    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: "SUSPENDED" },
    });

    const suspendedOrganizationProfile =
      await upsertAuthenticationProfile({ authUserId, email });

    assert.deepEqual(
      suspendedOrganizationProfile.activeMemberships,
      [],
    );

    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: "ACTIVE" },
    });
    await prisma.organizationMembership.update({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      data: { status: "SUSPENDED" },
    });

    const suspendedMembershipProfile =
      await upsertAuthenticationProfile({ authUserId, email });

    assert.deepEqual(
      suspendedMembershipProfile.activeMemberships,
      [],
    );
  } finally {
    await prisma.organizationMembership.deleteMany({
      where: { organizationId },
    });
    await prisma.organization.deleteMany({
      where: { id: organizationId },
    });
    await prisma.userProfile.deleteMany({
      where: { id: userId },
    });
  }
});
