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
  platformRole: true,
  accountStatus: true,
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
  return prisma.userProfile.upsert({
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
}