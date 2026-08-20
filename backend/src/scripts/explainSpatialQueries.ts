import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { prisma } from "../database/prisma.js";

type QueryPlanRow = {
  "QUERY PLAN": unknown;
};

type IndexRow = {
  indexname: string;
  indexdef: string;
};

type FixtureRowCounts = {
  incidents: number;
  cleanupEvents: number;
  organizationServiceAreas: number;
  administrativeAreas: number;
};

type PlanSummary = {
  nodeTypes: string[];
  indexes: string[];
};

export const requiredIndexes = [
  "incidents_geo_point_gist_idx",
  "cleanup_events_event_geo_point_gist_idx",
  "cleanup_events_public_map_published_idx",
  "cleanup_events_organization_updated_id_idx",
  "organization_service_areas_boundary_gist_idx",
  "organization_service_areas_organization_id_status_idx",
  "organization_service_areas_organization_status_id_idx",
  "administrative_areas_boundary_gist_idx",
] as const;

export const acceptedPlanIndexes: Record<string, readonly string[]> = {
  incidentViewport: ["incidents_geo_point_gist_idx"],
  incidentRadius: ["incidents_geo_point_gist_idx"],
  organizationIncidentViewport: ["incidents_geo_point_gist_idx"],
  publicEventViewport: [
    "cleanup_events_event_geo_point_gist_idx",
    "cleanup_events_public_map_published_idx",
  ],
  publicEventRadius: [
    "cleanup_events_event_geo_point_gist_idx",
    "cleanup_events_public_map_published_idx",
  ],
  organizationEventViewport: [
    "cleanup_events_event_geo_point_gist_idx",
    "cleanup_events_organization_updated_id_idx",
  ],
  serviceAreaViewport: [
    "organization_service_areas_boundary_gist_idx",
    "organization_service_areas_organization_id_status_idx",
    "organization_service_areas_organization_status_id_idx",
    "administrative_areas_boundary_gist_idx",
  ],
};

export const boundedFixtureScanLimits: Record<string, {
  rowCountKey: keyof FixtureRowCounts;
  maximumRows: number;
}> = {
  serviceAreaViewport: {
    rowCountKey: "organizationServiceAreas",
    maximumRows: 101,
  },
};

const sourceFiles = {
  incidentRepository: new URL(
    "../modules/incidents/repositories/incident.repository.ts",
    import.meta.url,
  ),
  cleanupEventRepository: new URL(
    "../modules/cleanupEvents/repositories/cleanupEvent.repository.ts",
    import.meta.url,
  ),
  mapSpatialRepository: new URL(
    "../modules/maps/repositories/mapSpatial.repository.ts",
    import.meta.url,
  ),
  mapValidation: new URL("../modules/maps/map.validation.ts", import.meta.url),
  mapConstants: new URL("../modules/maps/map.constants.ts", import.meta.url),
  prismaSchema: new URL("../../prisma/schema.prisma", import.meta.url),
  eventIndexMigration: new URL(
    "../../prisma/migrations/20260820140000_add_map_event_query_indexes/migration.sql",
    import.meta.url,
  ),
  serviceAreaIndexMigration: new URL(
    "../../prisma/migrations/20260820150000_add_service_area_map_cursor_index/migration.sql",
    import.meta.url,
  ),
  planCapture: new URL("./explainSpatialQueries.ts", import.meta.url),
} as const;

export function hashText(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return createHash("sha256").update(normalized).digest("hex");
}

export async function captureSourceHashes(): Promise<Record<string, string>> {
  return Object.fromEntries(await Promise.all(
    Object.entries(sourceFiles).map(async ([name, url]) => [
      name,
      hashText(await readFile(url, "utf8")),
    ]),
  ));
}

const explainMode = process.env.MAP_EXPLAIN_ANALYZE === "false"
  ? "EXPLAIN (FORMAT JSON)"
  : "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)";

export const queries = {
  incidentViewport: `
    SELECT incident."id"
    FROM "incidents" incident
    WHERE extensions.ST_Intersects(
      incident."geo_point",
      extensions.ST_MakeEnvelope(79.80, 6.80, 80.00, 7.10, 4326)::extensions.geography
    )
      AND extensions.ST_Covers(
        extensions.ST_MakeEnvelope(79.80, 6.80, 80.00, 7.10, 4326)::extensions.geography,
        incident."geo_point"
      )
      AND incident."status" IN ('ACTIVE'::"IncidentStatus", 'CLEANUP_ORGANIZED'::"IncidentStatus")
    ORDER BY incident."reported_at" DESC, incident."id" DESC
    LIMIT 101
  `,
  incidentRadius: `
    SELECT incident."id"
    FROM "incidents" incident
    WHERE extensions.ST_DWithin(
      incident."geo_point",
      extensions.ST_SetSRID(extensions.ST_MakePoint(79.8612, 6.9271), 4326)::extensions.geography,
      5000
    )
      AND incident."status" IN ('ACTIVE'::"IncidentStatus", 'CLEANUP_ORGANIZED'::"IncidentStatus")
    ORDER BY incident."reported_at" DESC, incident."id" DESC
    LIMIT 101
  `,
  organizationIncidentViewport: `
    WITH selected_organization AS (
      SELECT "id" FROM "organizations" WHERE "status" = 'ACTIVE'::"OrganizationStatus" LIMIT 1
    )
    SELECT DISTINCT incident."id"
    FROM "incidents" incident
    CROSS JOIN selected_organization organization
    WHERE extensions.ST_Covers(
      extensions.ST_MakeEnvelope(79.80, 6.80, 80.00, 7.10, 4326)::extensions.geography,
      incident."geo_point"
    )
      AND EXISTS (
        SELECT 1
        FROM "organization_service_areas" service_area
        LEFT JOIN "administrative_areas" administrative_area
          ON administrative_area."id" = service_area."administrative_area_id"
         AND administrative_area."is_active" = true
        WHERE service_area."organization_id" = organization."id"
          AND service_area."status" = 'ACTIVE'::"ServiceAreaStatus"
          AND extensions.ST_Covers(
            COALESCE(service_area."boundary", administrative_area."boundary"),
            incident."geo_point"
          )
      )
    ORDER BY incident."id"
    LIMIT 101
  `,
  publicEventViewport: `
    SELECT event."id"
    FROM "cleanup_events" event
    JOIN "organizations" organization
      ON organization."id" = event."organization_id"
     AND organization."status" = 'ACTIVE'::"OrganizationStatus"
    WHERE event."lifecycle_status" IN (
      'PUBLISHED'::"CleanupLifecycleStatus",
      'SCHEDULED'::"CleanupLifecycleStatus",
      'IN_PROGRESS'::"CleanupLifecycleStatus",
      'COMPLETION_SUBMITTED'::"CleanupLifecycleStatus"
    )
      AND event."published_at" IS NOT NULL
      AND extensions.ST_Covers(
        extensions.ST_MakeEnvelope(79.80, 6.80, 80.00, 7.10, 4326)::extensions.geography,
        event."event_geo_point"
      )
    ORDER BY event."published_at" DESC, event."id" DESC
    LIMIT 101
  `,
  publicEventRadius: `
    SELECT event."id"
    FROM "cleanup_events" event
    JOIN "organizations" organization
      ON organization."id" = event."organization_id"
     AND organization."status" = 'ACTIVE'::"OrganizationStatus"
    WHERE event."lifecycle_status" IN (
      'PUBLISHED'::"CleanupLifecycleStatus",
      'SCHEDULED'::"CleanupLifecycleStatus",
      'IN_PROGRESS'::"CleanupLifecycleStatus",
      'COMPLETION_SUBMITTED'::"CleanupLifecycleStatus"
    )
      AND event."published_at" IS NOT NULL
      AND extensions.ST_DWithin(
        event."event_geo_point",
        extensions.ST_SetSRID(extensions.ST_MakePoint(79.8612, 6.9271), 4326)::extensions.geography,
        5000
      )
    ORDER BY event."published_at" DESC, event."id" DESC
    LIMIT 101
  `,
  organizationEventViewport: `
    WITH selected_organization AS (
      SELECT "id" FROM "organizations" WHERE "status" = 'ACTIVE'::"OrganizationStatus" LIMIT 1
    )
    SELECT event."id"
    FROM "cleanup_events" event
    CROSS JOIN selected_organization organization
    WHERE event."organization_id" = organization."id"
      AND extensions.ST_Covers(
        extensions.ST_MakeEnvelope(79.80, 6.80, 80.00, 7.10, 4326)::extensions.geography,
        event."event_geo_point"
      )
    ORDER BY event."updated_at" DESC, event."id" DESC
    LIMIT 101
  `,
  serviceAreaViewport: `
    WITH selected_organization AS (
      SELECT "id" FROM "organizations" WHERE "status" = 'ACTIVE'::"OrganizationStatus" LIMIT 1
    )
    SELECT service_area."id"
    FROM "organization_service_areas" service_area
    LEFT JOIN "administrative_areas" administrative_area
      ON administrative_area."id" = service_area."administrative_area_id"
     AND administrative_area."is_active" = true
    WHERE service_area."organization_id" = (SELECT "id" FROM selected_organization)
      AND service_area."status" = 'ACTIVE'::"ServiceAreaStatus"
      AND COALESCE(service_area."boundary", administrative_area."boundary") IS NOT NULL
      AND extensions.ST_Intersects(
        COALESCE(service_area."boundary", administrative_area."boundary")::extensions.geometry,
        extensions.ST_MakeEnvelope(79.80, 6.80, 80.00, 7.10, 4326)
      )
    ORDER BY service_area."id"
    LIMIT 101
  `,
} as const;

function summarizePlan(plan: unknown): PlanSummary {
  const nodeTypes = new Set<string>();
  const indexes = new Set<string>();

  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const node = value as Record<string, unknown>;
    if (typeof node["Node Type"] === "string") nodeTypes.add(node["Node Type"]);
    if (typeof node["Index Name"] === "string") indexes.add(node["Index Name"]);
    if (node.Plan) visit(node.Plan);
    if (node.Plans) visit(node.Plans);
  };

  visit(plan);
  return { nodeTypes: [...nodeTypes], indexes: [...indexes] };
}

export async function main(): Promise<void> {
  const indexes = await prisma.$queryRaw<IndexRow[]>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN (
        'incidents',
        'cleanup_events',
        'organization_service_areas',
        'administrative_areas',
        'incident_reviews'
      )
    ORDER BY tablename, indexname
  `;

  const [rowCounts] = await prisma.$queryRaw<FixtureRowCounts[]>`
    SELECT
      (SELECT COUNT(*)::integer FROM "incidents") AS "incidents",
      (SELECT COUNT(*)::integer FROM "cleanup_events") AS "cleanupEvents",
      (SELECT COUNT(*)::integer FROM "organization_service_areas") AS "organizationServiceAreas",
      (SELECT COUNT(*)::integer FROM "administrative_areas") AS "administrativeAreas"
  `;

  const availableIndexNames = new Set(indexes.map(({ indexname }) => indexname));
  const missingIndexes = requiredIndexes.filter((name) => !availableIndexNames.has(name));
  if (missingIndexes.length > 0) {
    throw new Error(`Missing required MAP-03 indexes: ${missingIndexes.join(", ")}`);
  }

  const plans: Record<string, unknown> = {};
  const planSummary: Record<string, PlanSummary> = {};
  const indexEligibilityPlans: Record<string, unknown> = {};
  const indexEligibilitySummary: Record<string, PlanSummary> = {};
  const planChecks: Record<string, {
    acceptedIndexes: readonly string[];
    selectedAcceptedIndexes: string[];
    indexEligibilitySelectedIndexes: string[];
    naturalIndexSelected: boolean;
    boundedFixtureScanAccepted: boolean;
    evidenceKind: "NATURAL_INDEX" | "BOUNDED_FIXTURE_SCAN" | "UNSATISFIED";
    satisfied: boolean;
  }> = {};
  for (const [name, sql] of Object.entries(queries)) {
    const rows = await prisma.$queryRawUnsafe<QueryPlanRow[]>(`${explainMode} ${sql}`);
    plans[name] = rows[0]?.["QUERY PLAN"] ?? null;
    planSummary[name] = summarizePlan(plans[name]);
    const acceptedIndexes = acceptedPlanIndexes[name] ?? [];
    const selectedAcceptedIndexes = acceptedIndexes.filter((indexName) =>
      planSummary[name]!.indexes.includes(indexName));
    const naturalIndexSelected = selectedAcceptedIndexes.length > 0;
    const boundedScan = boundedFixtureScanLimits[name];
    const boundedFixtureScanAccepted = Boolean(
      boundedScan && rowCounts &&
      rowCounts[boundedScan.rowCountKey] <= boundedScan.maximumRows,
    );
    if (!naturalIndexSelected && boundedFixtureScanAccepted) {
      const eligibilityRows = await prisma.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
        return transaction.$queryRawUnsafe<QueryPlanRow[]>(`EXPLAIN (FORMAT JSON) ${sql}`);
      });
      indexEligibilityPlans[name] = eligibilityRows[0]?.["QUERY PLAN"] ?? null;
      indexEligibilitySummary[name] = summarizePlan(indexEligibilityPlans[name]);
    }
    const indexEligibilitySelectedIndexes = acceptedIndexes.filter((indexName) =>
      indexEligibilitySummary[name]?.indexes.includes(indexName));
    const boundedFixtureEvidenceSatisfied = boundedFixtureScanAccepted &&
      indexEligibilitySelectedIndexes.length > 0;
    planChecks[name] = {
      acceptedIndexes,
      selectedAcceptedIndexes,
      indexEligibilitySelectedIndexes,
      naturalIndexSelected,
      boundedFixtureScanAccepted,
      evidenceKind: naturalIndexSelected
        ? "NATURAL_INDEX"
        : boundedFixtureEvidenceSatisfied
          ? "BOUNDED_FIXTURE_SCAN"
          : "UNSATISFIED",
      satisfied: naturalIndexSelected || boundedFixtureEvidenceSatisfied,
    };
  }

  const failedPlanChecks = Object.entries(planChecks)
    .filter(([, check]) => !check.satisfied)
    .map(([name]) => name);
  if (failedPlanChecks.length > 0) {
    throw new Error(
      `MAP-03 query plans lacked an accepted index or bounded-fixture explanation: ${failedPlanChecks.join(", ")}`,
    );
  }

  const queryHashes = Object.fromEntries(
    Object.entries(queries).map(([name, sql]) => [name, hashText(sql)]),
  );
  const sourceHashes = await captureSourceHashes();

  const output = `${JSON.stringify({
    capturedAt: new Date().toISOString(),
    explainMode,
    rowCounts,
    indexes,
    planSummary,
    indexEligibilitySummary,
    planChecks,
    queryHashes,
    sourceHashes,
    plans,
    indexEligibilityPlans,
  }, null, 2)}\n`;
  const outputPath = process.env.MAP_EXPLAIN_OUTPUT?.trim();
  if (outputPath) {
    await writeFile(outputPath, output, "utf8");
  } else {
    process.stdout.write(output);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
    .catch((error: unknown) => {
      console.error("Unable to capture EcoTrack spatial query plans.", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
