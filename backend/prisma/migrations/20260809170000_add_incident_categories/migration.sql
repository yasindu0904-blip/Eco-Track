-- Add the global incident category lookup independently of the deferred
-- incident and service-area geography design.

BEGIN;

CREATE TABLE "public"."incident_categories" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "incident_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "incident_categories_name_key"
ON "public"."incident_categories"("name");

-- EcoTrack uses the Express API as its database security boundary. RLS is
-- enabled table by table, while Supabase client roles receive no direct access.
ALTER TABLE "public"."incident_categories" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
ON TABLE "public"."incident_categories"
FROM anon, authenticated;

COMMIT;
