\set ON_ERROR_STOP on

-- The PostGIS image initially installs PostGIS in public. Supabase installs it
-- in extensions, and EcoTrack migrations intentionally use extensions.geography.
DROP EXTENSION IF EXISTS postgis_tiger_geocoder CASCADE;
DROP EXTENSION IF EXISTS postgis_topology CASCADE;
DROP EXTENSION IF EXISTS postgis CASCADE;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION postgis WITH SCHEMA extensions;

-- EcoTrack migrations revoke direct table access from these Supabase roles.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'anon'
    ) THEN
        CREATE ROLE anon NOLOGIN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
    ) THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
END
$$;
