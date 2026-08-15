-- Store each official GN Division boundary once and reference it from
-- organization service-area requests.
CREATE TYPE "AdministrativeAreaLevel" AS ENUM ('GN_DIVISION');

CREATE TABLE "administrative_areas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "level" "AdministrativeAreaLevel" NOT NULL DEFAULT 'GN_DIVISION',
    "official_code" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "gn_number" TEXT,
    "divisional_secretariat_name" TEXT,
    "divisional_secretariat_code" TEXT,
    "district_name" TEXT,
    "district_code" TEXT,
    "province_name" TEXT,
    "province_code" TEXT,
    "boundary" extensions.geography(MultiPolygon,4326) NOT NULL,
    "source_name" TEXT NOT NULL,
    "source_url" TEXT,
    "source_version" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "administrative_areas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "administrative_areas_level_official_code_key"
ON "administrative_areas"("level", "official_code");

CREATE INDEX "administrative_areas_name_en_idx"
ON "administrative_areas"("name_en");

CREATE INDEX "administrative_areas_district_name_divisional_secretariat_name_idx"
ON "administrative_areas"("district_name", "divisional_secretariat_name");

CREATE INDEX "administrative_areas_is_active_level_idx"
ON "administrative_areas"("is_active", "level");

CREATE INDEX "administrative_areas_boundary_gist_idx"
ON "administrative_areas" USING GIST ("boundary");

-- Keep the old applicant-supplied columns nullable so existing development
-- records are preserved. New application code writes administrative_area_id.
ALTER TABLE "organization_service_areas"
ADD COLUMN "administrative_area_id" UUID,
ALTER COLUMN "area_name" DROP NOT NULL,
ALTER COLUMN "boundary" DROP NOT NULL;

CREATE INDEX "organization_service_areas_administrative_area_id_idx"
ON "organization_service_areas"("administrative_area_id");

CREATE UNIQUE INDEX "organization_service_areas_organization_id_administrative_area_id_key"
ON "organization_service_areas"("organization_id", "administrative_area_id");

ALTER TABLE "organization_service_areas"
ADD CONSTRAINT "organization_service_areas_administrative_area_id_fkey"
FOREIGN KEY ("administrative_area_id") REFERENCES "administrative_areas"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organization_service_areas"
ADD CONSTRAINT "organization_service_areas_reference_or_legacy_boundary_check"
CHECK (
  "administrative_area_id" IS NOT NULL
  OR ("area_name" IS NOT NULL AND "boundary" IS NOT NULL)
);
