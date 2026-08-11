-- EcoTrack clients access these public-schema tables only through the
-- authenticated Express API. No direct Supabase Data API access is allowed.
ALTER TABLE "public"."administrative_areas"
ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."organization_service_areas"
ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."notifications"
ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
ON TABLE
  "public"."administrative_areas",
  "public"."organization_service_areas",
  "public"."notifications"
FROM anon, authenticated;
