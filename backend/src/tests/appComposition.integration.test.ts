import assert from "node:assert/strict";
import type { Server } from "node:http";
import test, { after } from "node:test";

import { createApp } from "../app.js";
import { authorizationDependencies } from "../authorization/authorization.dependencies.js";
import { authenticationDependencies } from "../modules/auth/auth.dependencies.js";
import { cleanupEventDependencies } from "../modules/cleanupEvents/cleanupEvent.dependencies.js";
import { cleanupWorkflowDependencies } from "../modules/cleanupWorkflows/cleanupWorkflow.dependencies.js";
import { dashboardDependencies } from "../modules/dashboards/dashboard.dependencies.js";
import { incidentDependencies } from "../modules/incidents/incident.dependencies.js";
import { membershipAdministrationDependencies } from "../modules/memberships/administration/membershipAdministration.dependencies.js";
import { membershipSelfServiceDependencies } from "../modules/memberships/selfService/membershipSelfService.dependencies.js";
import { notificationDependencies } from "../modules/notifications/notification.dependencies.js";
import { organizationApplicationDependencies } from "../modules/organizations/application/application.dependencies.js";
import { rewardDependencies } from "../modules/rewards/reward.dependencies.js";

const app = createApp(authenticationDependencies, {
  webOrigin: "http://integration.ecotrack.local",
  authorizationDependencies,
  cleanupWorkflowDependencies,
  cleanupEventDependencies,
  membershipAdministrationDependencies,
  notificationDependencies,
  membershipSelfServiceDependencies,
  incidentDependencies,
  organizationApplicationDependencies,
  rewardDependencies,
  dashboardDependencies,
});

let server: Server | undefined;
let baseUrl = "";

async function ensureServer(): Promise<void> {
  if (server) return;

  const listeningServer = await new Promise<Server>((resolve) => {
    const createdServer = app.listen(0, "127.0.0.1", () => resolve(createdServer));
  });
  server = listeningServer;

  const address = listeningServer.address();
  if (!address || typeof address === "string") {
    throw new Error("The integration app did not receive a TCP port.");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
}

after(async () => {
  if (!server) return;

  await new Promise<void>((resolve, reject) => {
    server!.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

const mountedProtectedRoutes = [
  { method: "GET", path: "/api/v1/auth/me" },
  { method: "PUT", path: "/api/v1/profile/complete" },
  { method: "GET", path: "/api/v1/dashboards/citizen" },
  { method: "GET", path: "/api/v1/notifications" },
  { method: "GET", path: "/api/v1/organizations" },
  { method: "GET", path: "/api/v1/organization-memberships/me/active" },
  { method: "GET", path: "/api/v1/rewards/me/summary" },
  { method: "GET", path: "/api/v1/incidents/categories" },
  { method: "GET", path: "/api/v1/organizations/00000000-0000-4000-8000-000000000001/cleanup-workflow" },
  { method: "GET", path: "/api/v1/events" },
  { method: "GET", path: "/api/v1/administrative-areas" },
  { method: "GET", path: "/api/v1/organization-applications/me" },
  { method: "GET", path: "/api/v1/super-admin/organization-applications" },
] as const;

test("production composition mounts every approved router before the 404 handler", async () => {
  await ensureServer();

  for (const { method, path } of mountedProtectedRoutes) {
    const response = await fetch(`${baseUrl}${path}`, { method });
    const body = await response.json() as {
      error?: { code?: string };
    };

    assert.equal(
      response.status,
      401,
      `${path} should reach authentication middleware instead of returning 404`,
    );
    assert.notEqual(body.error?.code, "ROUTE_NOT_FOUND");
  }
});

test("global middleware order preserves health, security, CORS, and final 404 handling", async () => {
  await ensureServer();

  const health = await fetch(`${baseUrl}/health`, {
    headers: { origin: "http://integration.ecotrack.local" },
  });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("x-powered-by"), null);
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.equal(
    health.headers.get("access-control-allow-origin"),
    "http://integration.ecotrack.local",
  );

  const missing = await fetch(`${baseUrl}/api/v1/not-a-real-feature`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), {
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "The requested route was not found.",
    },
  });
});
