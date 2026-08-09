import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prisma.js";
import {
  AccountStatus,
  PlatformRole,
} from "../src/generated/prisma/enums.js";

async function main(): Promise<void> {
  const authUserId = env.SUPER_ADMIN_AUTH_USER_ID.trim();
  const email = env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
  const fullName = env.SUPER_ADMIN_FULL_NAME.trim();

  if (!authUserId) {
    throw new Error(
      "SUPER_ADMIN_AUTH_USER_ID is empty. Create the Supabase Auth user and copy its UUID into backend/.env.",
    );
  }

  /*
   * Prevent accidentally connecting an email that already belongs
   * to another Supabase Auth user UUID.
   */
  const existingProfileWithEmail =
    await prisma.userProfile.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        authUserId: true,
      },
    });

  if (
    existingProfileWithEmail &&
    existingProfileWithEmail.authUserId !== authUserId
  ) {
    throw new Error(
      `A user profile with email "${email}" already exists but uses a different authUserId.`,
    );
  }

  /*
   * Upsert makes the seed safe to run more than once:
   *
   * Existing profile -> update it
   * Missing profile  -> create it
   */
  const superAdminProfile = await prisma.userProfile.upsert({
    where: {
      authUserId,
    },

    update: {
      email,
      fullName,
      platformRole: PlatformRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    },

    create: {
      authUserId,
      email,
      fullName,
      platformRole: PlatformRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    },

    select: {
      platformRole: true,
      accountStatus: true,
    },
  });

  const platformSettings = await prisma.platformSettings.upsert({
    where: {
      id: 1,
    },

    update: {},

    create: {
      id: 1,
      incidentHighlightHours: 48,
      incidentUnaddressedDays: 7,
    },

    select: {
      id: true,
      incidentHighlightHours: true,
      incidentUnaddressedDays: true,
    },
  });

  console.log("EcoTrack super-admin profile is ready:");

  console.log(
    JSON.stringify(
      {
        superAdminProfile,
        platformSettings,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error("EcoTrack database seed failed:");
    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
