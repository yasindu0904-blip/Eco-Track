import { prisma } from "../database/prisma.js";

type ConnectionInformation = {
  databaseName: string;
  schemaName: string;
  databaseUser: string;
};

async function checkDatabase(): Promise<void> {
  console.log("Checking EcoTrack database connection...");

  /*
   * This simple SELECT confirms that PostgreSQL can be reached.
   * It also shows which database, schema, and database user are active.
   */
  const connectionInformation =
    await prisma.$queryRaw<ConnectionInformation[]>`
      SELECT
        current_database() AS "databaseName",
        current_schema() AS "schemaName",
        current_user AS "databaseUser"
    `;

  const currentConnection = connectionInformation[0];

  if (!currentConnection) {
    throw new Error(
      "PostgreSQL connected but did not return connection information.",
    );
  }

  /*
   * These read-only count queries confirm that Prisma can access
   * the tables created by the first EcoTrack migration.
   */
  const [
    userProfileCount,
    organizationCount,
    organizationMembershipCount,
    platformSettingsCount,
  ] = await Promise.all([
    prisma.userProfile.count(),
    prisma.organization.count(),
    prisma.organizationMembership.count(),
    prisma.platformSettings.count(),
  ]);

  console.log("EcoTrack database connection succeeded.");
  console.log("");
  console.log(`Database: ${currentConnection.databaseName}`);
  console.log(`Schema: ${currentConnection.schemaName}`);
  console.log(`Database user: ${currentConnection.databaseUser}`);
  console.log("");
  console.log("Current table records:");
  console.log(`User profiles: ${userProfileCount}`);
  console.log(`Organizations: ${organizationCount}`);
  console.log(
    `Organization memberships: ${organizationMembershipCount}`,
  );
  console.log(`Platform settings rows: ${platformSettingsCount}`);
}

checkDatabase()
  .catch((error: unknown) => {
    console.error("EcoTrack database check failed:");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
