import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";

import type {
  GeoJsonBoundary,
  MapLocation,
  MapViewportQuery,
  OrganizationServiceAreaBoundaryCollection,
  OrganizationServiceAreaBoundaryFeature,
} from "../map.types.js";

type CoverageRow = {
  covered: boolean;
};

type ServiceAreaBoundaryRow = {
  id: string;
  name: string;
  officialCode: string | null;
  status: string;
  geometryJson: string;
};

/**
 * Checks the authoritative active service-area geometry. The caller must still
 * establish authenticated tenant context before using this result to expose
 * organization-only incident data.
 */
export async function isLocationCoveredByActiveOrganizationServiceArea(
  prisma: PrismaClient,
  organizationId: string,
  location: MapLocation,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<CoverageRow[]>`
    SELECT EXISTS (
      SELECT 1
      FROM "organization_service_areas" AS service_area
      JOIN "organizations" AS organization
        ON organization."id" = service_area."organization_id"
       AND organization."status" = 'ACTIVE'::"OrganizationStatus"
      LEFT JOIN "administrative_areas" AS administrative_area
        ON administrative_area."id" = service_area."administrative_area_id"
       AND administrative_area."is_active" = true
      WHERE service_area."organization_id" = ${organizationId}::uuid
        AND service_area."status" = 'ACTIVE'::"ServiceAreaStatus"
        AND COALESCE(
          service_area."boundary",
          administrative_area."boundary"
        ) IS NOT NULL
        AND extensions.ST_Covers(
          COALESCE(
            service_area."boundary",
            administrative_area."boundary"
          ),
          extensions.ST_SetSRID(
            extensions.ST_MakePoint(
              ${location.longitude}::double precision,
              ${location.latitude}::double precision
            ),
            4326
          )::extensions.geography
        )
    ) AS "covered"
  `;

  return rows[0]?.covered ?? false;
}

/**
 * Produces an active organization-scoped GeoJSON overlay for authorized map
 * rendering.
 */
export async function listOrganizationServiceAreaBoundaryFeatures(
  prisma: PrismaClient,
  organizationId: string,
  query: MapViewportQuery | { scope: "all"; limit: number },
): Promise<OrganizationServiceAreaBoundaryCollection> {
  const boundaryDetailZoom = "scope" in query ? 15 : query.zoom;
  const simplificationTolerance = boundaryDetailZoom >= 15
    ? 0.00001
    : boundaryDetailZoom >= 12
      ? 0.00005
      : boundaryDetailZoom >= 9
        ? 0.0002
        : 0.001;
  const viewportFilter = "scope" in query
    ? Prisma.empty
    : Prisma.sql`
      AND extensions.ST_Intersects(
        COALESCE(
          service_area."boundary",
          administrative_area."boundary"
        )::extensions.geometry,
        extensions.ST_MakeEnvelope(
          ${query.west}::double precision,
          ${query.south}::double precision,
          ${query.east}::double precision,
          ${query.north}::double precision,
          4326
        )
      )
    `;
  const rows = await prisma.$queryRaw<
    ServiceAreaBoundaryRow[]
  >`
    SELECT
      service_area."id",
      COALESCE(
        administrative_area."name_en",
        service_area."area_name",
        'Organization service area'
      ) AS "name",
      administrative_area."official_code" AS "officialCode",
      service_area."status"::text AS "status",
      extensions.ST_AsGeoJSON(
        extensions.ST_Multi(
          extensions.ST_SimplifyPreserveTopology(
            COALESCE(
              service_area."boundary",
              administrative_area."boundary"
            )::extensions.geometry,
            ${simplificationTolerance}::double precision
          )
        ),
        6
      ) AS "geometryJson"
    FROM "organization_service_areas" AS service_area
    JOIN "organizations" AS organization
      ON organization."id" = service_area."organization_id"
     AND organization."status" = 'ACTIVE'::"OrganizationStatus"
    LEFT JOIN "administrative_areas" AS administrative_area
      ON administrative_area."id" = service_area."administrative_area_id"
     AND administrative_area."is_active" = true
    WHERE service_area."organization_id" = ${organizationId}::uuid
      AND service_area."status" = 'ACTIVE'::"ServiceAreaStatus"
      AND COALESCE(
        service_area."boundary",
        administrative_area."boundary"
      ) IS NOT NULL
      ${viewportFilter}
    ORDER BY "name", service_area."id"
    LIMIT ${query.limit + 1}
  `;

  const truncated = rows.length > query.limit;
  const features: OrganizationServiceAreaBoundaryFeature[] =
    rows.slice(0, query.limit).map((row) => ({
      type: "Feature",
      geometry: JSON.parse(
        row.geometryJson,
      ) as GeoJsonBoundary,
      properties: {
        id: row.id,
        name: row.name,
        officialCode: row.officialCode,
        status: row.status,
      },
    }));

  return {
    type: "FeatureCollection",
    features,
    truncated,
  };
}
