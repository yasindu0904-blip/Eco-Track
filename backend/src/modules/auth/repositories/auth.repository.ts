import { prisma } from "../../../database/prisma.js";

import type {
  AuthenticatedUserProfile,
  VerifiedSupabaseIdentity,
} from "../auth.types.js";

const authenticatedUserProfileSelect = {
  id: true,
  email: true,
  fullName: true,
  phoneNumber: true,
  profileCompletedAt: true,
  platformRole: true,
  accountStatus: true,
  memberships: {
    where: {
      status: "ACTIVE",
      organization: {
        status: "ACTIVE",
      },
    },
    orderBy: {
      joinedAt: "asc",
    },
    select: {
      id: true,
      organizationId: true,
      role: true,
      status: true,
      organization: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  },
} as const;

export async function findProfileAuthUserIdByEmail(
  email: string,
): Promise<string | null> {
  const profile = await prisma.userProfile.findUnique({
    where: {
      email,
    },
    select: {
      authUserId: true,
    },
  });

  return profile?.authUserId ?? null;
}

export async function upsertAuthenticationProfile(
  identity: VerifiedSupabaseIdentity,
): Promise<AuthenticatedUserProfile> {
  const { memberships, ...profile } =
    await prisma.userProfile.upsert({
      where: {
        authUserId: identity.authUserId,
      },
      update: {
        email: identity.email,
      },
      create: {
        authUserId: identity.authUserId,
        email: identity.email,
      },
      select: authenticatedUserProfileSelect,
    });

  return {
    ...profile,
    activeMemberships: memberships.map((membership) => ({
      id: membership.id,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      organizationSlug: membership.organization.slug,
      role: membership.role,
      status: membership.status,
    })),
  };
}
