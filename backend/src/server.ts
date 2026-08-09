import { createApp } from "./app.js";

import { env } from "./config/env.js";
import { prisma } from "./database/prisma.js";

import { authenticationDependencies } from "./modules/auth/auth.dependencies.js";

const app = createApp(
  authenticationDependencies,
  {
    webOrigin: env.WEB_ORIGIN,
  },
);

const server = app.listen(
  env.PORT,
  () => {
    console.log(
      `EcoTrack backend listening on port ${env.PORT}.`,
    );
  },
);

let shutdownStarted = false;

async function shutdown(
  signal: string,
): Promise<void> {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;

  console.log(
    `${signal} received. Shutting down EcoTrack backend.`,
  );

  server.close(async (serverError) => {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error(
        "Prisma disconnection failed:",
        disconnectError,
      );

      process.exitCode = 1;
    }

    if (serverError) {
      console.error(
        "HTTP server shutdown failed:",
        serverError,
      );

      process.exitCode = 1;
    }
  });
}

process.once(
  "SIGINT",
  () => {
    void shutdown("SIGINT");
  },
);

process.once(
  "SIGTERM",
  () => {
    void shutdown("SIGTERM");
  },
);