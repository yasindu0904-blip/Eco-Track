import { prisma } from "../database/prisma.js";

const sourceLayerUrl =
  "https://gisapps.nsdi.gov.lk/server/rest/services/SLNSDI/Survey_10k/MapServer/2";
const sourceItemId = "81bb958f54b4421db599f3b3ac151ca9";
const pageSize = 250;
const sourceWhere = process.env.GN_IMPORT_WHERE?.trim() || "1=1";
const initialOffset = Number.parseInt(process.env.GN_IMPORT_OFFSET ?? "0", 10);

if (!Number.isInteger(initialOffset) || initialOffset < 0) {
  throw new Error("GN_IMPORT_OFFSET must be a non-negative integer.");
}

type GeoJsonGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
};

type GnProperties = {
  gnd_name?: unknown;
  gnd_code?: unknown;
  gnd_number?: unknown;
  admin_code?: unknown;
  ds_division_name?: unknown;
  ds_division_code?: unknown;
  district_name?: unknown;
  district_code?: unknown;
  province_name?: unknown;
  province_code?: unknown;
  data_source?: unknown;
};

type GeoJsonFeatureCollection = {
  features?: Array<{
    geometry?: GeoJsonGeometry | null;
    properties?: GnProperties;
  }>;
};

async function fetchPage(offset: number): Promise<GeoJsonFeatureCollection> {
  const query = new URLSearchParams({
    where: sourceWhere,
    outFields: [
      "gnd_name",
      "gnd_code",
      "gnd_number",
      "admin_code",
      "ds_division_name",
      "ds_division_code",
      "district_name",
      "district_code",
      "province_name",
      "province_code",
      "data_source",
    ].join(","),
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "6",
    orderByFields: "objectid",
    resultOffset: String(offset),
    resultRecordCount: String(pageSize),
    f: "geojson",
  });

  const response = await fetch(`${sourceLayerUrl}/query?${query.toString()}`);

  if (!response.ok) {
    throw new Error(`NSDI request failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as GeoJsonFeatureCollection;
}

async function importPage(
  features: NonNullable<GeoJsonFeatureCollection["features"]>,
): Promise<number> {
  const featuresJson = JSON.stringify(features);

  return prisma.$executeRaw`
    WITH source_features AS (
      SELECT value AS feature
      FROM jsonb_array_elements(${featuresJson}::jsonb)
    ),
    normalized AS (
      SELECT
        NULLIF(BTRIM(feature->'properties'->>'admin_code'), '') AS official_code,
        NULLIF(BTRIM(feature->'properties'->>'gnd_name'), '') AS name_en,
        NULLIF(BTRIM(feature->'properties'->>'gnd_number'), '') AS gn_number,
        NULLIF(BTRIM(feature->'properties'->>'ds_division_name'), '') AS ds_name,
        NULLIF(BTRIM(feature->'properties'->>'ds_division_code'), '') AS ds_code,
        NULLIF(BTRIM(feature->'properties'->>'district_name'), '') AS district_name,
        NULLIF(BTRIM(feature->'properties'->>'district_code'), '') AS district_code,
        NULLIF(BTRIM(feature->'properties'->>'province_name'), '') AS province_name,
        NULLIF(BTRIM(feature->'properties'->>'province_code'), '') AS province_code,
        COALESCE(
          NULLIF(BTRIM(feature->'properties'->>'data_source'), ''),
          'Sri Lanka NSDI'
        ) AS source_name,
        extensions.ST_Multi(
          extensions.ST_SetSRID(
            extensions.ST_GeomFromGeoJSON(feature->'geometry'),
            4326
          )
        ) AS boundary
      FROM source_features
      WHERE feature->'geometry'->>'type' IN ('Polygon', 'MultiPolygon')
    ),
    valid AS (
      SELECT *
      FROM normalized
      WHERE official_code IS NOT NULL
        AND official_code <> '0'
        AND name_en IS NOT NULL
        AND NOT extensions.ST_IsEmpty(boundary)
        AND extensions.ST_IsValid(boundary)
    )
    INSERT INTO "administrative_areas" (
      "id",
      "level",
      "official_code",
      "name_en",
      "gn_number",
      "divisional_secretariat_name",
      "divisional_secretariat_code",
      "district_name",
      "district_code",
      "province_name",
      "province_code",
      "boundary",
      "source_name",
      "source_url",
      "source_version",
      "is_active",
      "imported_at",
      "updated_at"
    )
    SELECT
      gen_random_uuid(),
      'GN_DIVISION'::"AdministrativeAreaLevel",
      official_code,
      name_en,
      gn_number,
      ds_name,
      ds_code,
      district_name,
      district_code,
      province_name,
      province_code,
      boundary::extensions.geography,
      source_name,
      ${sourceLayerUrl},
      ${`service-item-${sourceItemId}`},
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM valid
    ON CONFLICT ("level", "official_code") DO UPDATE SET
      "name_en" = EXCLUDED."name_en",
      "gn_number" = EXCLUDED."gn_number",
      "divisional_secretariat_name" = EXCLUDED."divisional_secretariat_name",
      "divisional_secretariat_code" = EXCLUDED."divisional_secretariat_code",
      "district_name" = EXCLUDED."district_name",
      "district_code" = EXCLUDED."district_code",
      "province_name" = EXCLUDED."province_name",
      "province_code" = EXCLUDED."province_code",
      "boundary" = EXCLUDED."boundary",
      "source_name" = EXCLUDED."source_name",
      "source_url" = EXCLUDED."source_url",
      "source_version" = EXCLUDED."source_version",
      "is_active" = true,
      "imported_at" = CURRENT_TIMESTAMP,
      "updated_at" = CURRENT_TIMESTAMP
  `;
}

async function main(): Promise<void> {
  console.log("Importing official GN Divisions from Sri Lanka NSDI...");
  console.log(`Source filter: ${sourceWhere}`);
  console.log(`Starting source offset: ${initialOffset}`);

  let offset = initialOffset;
  let imported = 0;
  let skipped = 0;

  while (true) {
    const page = await fetchPage(offset);
    const features = page.features ?? [];

    const importedFromPage = await importPage(features);
    imported += importedFromPage;
    skipped += features.length - importedFromPage;

    console.log(`Processed ${offset + features.length} source records...`);

    if (features.length < pageSize) {
      break;
    }

    offset += features.length;
  }

  console.log(`GN Division import finished: ${imported} imported, ${skipped} skipped.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
