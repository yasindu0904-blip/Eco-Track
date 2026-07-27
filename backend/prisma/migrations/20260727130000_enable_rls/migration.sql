-- ============================================================
-- EcoTrack Row Level Security
-- ============================================================

-- Enable RLS because these tables are in Supabase's exposed
-- public schema.

ALTER TABLE "public"."user_profiles"
ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."organizations"
ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."organization_members"
ENABLE ROW LEVEL SECURITY;

-- EcoTrack frontend applications must not access these tables
-- directly through the Supabase Data API.
-- All application database access currently goes through the
-- Express backend and Prisma.

REVOKE ALL PRIVILEGES
ON TABLE "public"."user_profiles"
FROM anon, authenticated;

REVOKE ALL PRIVILEGES
ON TABLE "public"."organizations"
FROM anon, authenticated;

REVOKE ALL PRIVILEGES
ON TABLE "public"."organization_members"
FROM anon, authenticated;