import { ApplicationError } from "../../../errors/applicationError.js";

import {
  findProfileAuthUserIdByEmail,
  upsertAuthenticationProfile,
} from "../repositories/auth.repository.js";

import type {
  AuthenticatedUserProfile,
  VerifiedSupabaseIdentity,
} from "../auth.types.js";

export async function provisionOrSynchronizeProfile(
  identity: VerifiedSupabaseIdentity,
): Promise<AuthenticatedUserProfile> {
  const existingAuthUserId =
    await findProfileAuthUserIdByEmail(identity.email);

  if (
    existingAuthUserId &&
    existingAuthUserId !== identity.authUserId
  ) {
    throw new ApplicationError(
      409,
      "AUTH_IDENTITY_CONFLICT",
      "This verified email is already connected to another EcoTrack account.",
    );
  }

  return upsertAuthenticationProfile(identity);
}