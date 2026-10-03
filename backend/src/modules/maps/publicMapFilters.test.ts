import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { listPublicIncidentsByViewport } from "../incidents/repositories/incident.repository.js";
import { publicIncidentViewportDiscoveryQuerySchema } from "../incidents/incident.validation.js";
import { listPublicCleanupEventMapRecords } from "../cleanupEvents/repositories/cleanupEvent.repository.js";
import { cleanupEventMapQuerySchema } from "../cleanupEvents/cleanupEvent.validation.js";

const areaId = "07e253e8-e6f8-4f67-b82a-831a32dc0462";
const userId = "e76050ed-90f5-4e0c-8d0e-2ed49258e2db";
const viewport = { west: 79.8, south: 6.8, east: 80, north: 7, zoom: 12, limit: 20 };
function captureQuery() {
  let query: Prisma.Sql;
  const prisma = { $queryRaw: async (input: Prisma.Sql | TemplateStringsArray, ...values: unknown[]) => {
    query = Array.isArray(input) ? Prisma.sql(input as TemplateStringsArray, ...values) : input as Prisma.Sql;
    return [];
  } } as unknown as PrismaClient;
  return { prisma, read: () => query! };
}

test("GN and lifecycle discovery filters validate UUIDs and supported sections", () => {
  assert.equal(publicIncidentViewportDiscoveryQuerySchema.safeParse({ ...viewport, administrativeAreaId: areaId, awaitingCleanup: "true" }).success, true);
  assert.equal(publicIncidentViewportDiscoveryQuerySchema.safeParse({ ...viewport, administrativeAreaId: "invalid" }).success, false);
  for (const section of ["upcoming", "ongoing", "past", "cancelled"]) {
    assert.equal(cleanupEventMapQuerySchema.safeParse({ ...viewport, administrativeAreaId: areaId, section }).success, true);
  }
  assert.equal(cleanupEventMapQuerySchema.safeParse({ ...viewport, section: "draft" }).success, false);
  assert.equal(cleanupEventMapQuerySchema.safeParse({ ...viewport, administrativeAreaId: "invalid" }).success, false);
});

test("incident GN polygon and awaiting lifecycle checks run before the cursor limit", async () => {
  const db = captureQuery();
  await listPublicIncidentsByViewport(db.prisma, { ...viewport, cursor: null, currentUserId: userId, administrativeAreaId: areaId, awaitingCleanup: true });
  const query = db.read();
  assert.match(query.sql, /ST_Covers\(selected_area\."boundary", incident\."geo_point"\)/);
  assert.match(query.sql, /selected_area\."is_active" = true/);
  assert.match(query.sql, /selected_area\."level" = 'GN_DIVISION'/);
  assert.match(query.sql, /NOT EXISTS[\s\S]*'PUBLISHED'/);
  assert.ok(query.sql.indexOf('selected_area."boundary"') < query.sql.indexOf("LIMIT"));
  assert.ok(query.values.includes(areaId));
  assert.equal(query.values.at(-1), 21);
});

test("omitting GN retains the bounded viewport and omits the polygon filter", async () => {
  const db = captureQuery();
  await listPublicCleanupEventMapRecords(db.prisma, { ...viewport, cursor: null, userId });
  assert.doesNotMatch(db.read().sql, /selected_area/);
  assert.match(db.read().sql, /ST_MakeEnvelope/);
  assert.ok(db.read().values.includes("PUBLISHED"));
});

for (const [section, lifecycle, operator, order] of [
  ["upcoming", "PUBLISHED", ">", "ASC"], ["ongoing", "PUBLISHED", "<=", "DESC"],
  ["past", "COMPLETED", null, "DESC"], ["cancelled", "CANCELLED", null, "DESC"],
] as const) {
  test(`${section} event map uses its lifecycle, GN polygon and stable start-date cursor`, async () => {
    const db = captureQuery();
    const sortAt = new Date("2026-10-03T00:00:00Z");
    await listPublicCleanupEventMapRecords(db.prisma, { ...viewport, section, administrativeAreaId: areaId, cursor: { sortAt, id: areaId }, userId });
    const query = db.read();
    assert.ok(query.values.includes(lifecycle));
    assert.ok(query.values.includes(areaId));
    assert.ok(query.values.includes(sortAt));
    assert.match(query.sql, /ST_Covers\(selected_area\."boundary", event\."event_geo_point"\)/);
    assert.match(query.sql, /organization\."status" = 'ACTIVE'/);
    assert.ok(query.sql.indexOf('selected_area."boundary"') < query.sql.indexOf("LIMIT"));
    if (operator) assert.ok(query.sql.includes(`event."starts_at" ${operator}`));
    assert.ok(query.sql.includes(`ORDER BY event."starts_at" ${order}, event."id" ${order}`));
    assert.equal(query.values.at(-1), 21);
  });
}
