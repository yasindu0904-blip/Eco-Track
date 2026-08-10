-- Supabase installs PostGIS types and functions in the extensions schema.
SET search_path = public, extensions;

-- CreateEnum
CREATE TYPE "ServiceAreaStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'INACTIVE');

-- CreateTable
CREATE TABLE "organization_service_areas" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "reviewed_by_user_id" UUID,
    "area_name" TEXT NOT NULL,
    "boundary" geography(MultiPolygon,4326) NOT NULL,
    "status" "ServiceAreaStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewed_at" TIMESTAMPTZ(6),
    "review_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_service_areas_organization_id_idx" ON "organization_service_areas"("organization_id");

-- CreateIndex
CREATE INDEX "organization_service_areas_organization_id_status_idx" ON "organization_service_areas"("organization_id", "status");

-- CreateIndex
CREATE INDEX "organization_service_areas_boundary_gist_idx" ON "organization_service_areas" USING GIST ("boundary");

-- AddForeignKey
ALTER TABLE "organization_service_areas" ADD CONSTRAINT "organization_service_areas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_service_areas" ADD CONSTRAINT "organization_service_areas_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;


