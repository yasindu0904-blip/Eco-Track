\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN IF current_database() <> 'ecotrack_m2_isolated' THEN RAISE EXCEPTION 'Wrong target database'; END IF; END $$;
SELECT current_database() AS database, current_user AS role, extensions.postgis_full_version();
SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at FROM public._prisma_migrations ORDER BY migration_name;
SELECT c.relname, c.relrowsecurity,
has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS anon_any_data_privilege,
has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS authenticated_any_data_privilege
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> '_prisma_migrations' ORDER BY c.relname;
SELECT conrelid::regclass AS table_name, conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conrelid::regclass::text,conname;
SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND (indexdef LIKE '%WHERE%' OR indexdef LIKE '%gist%') ORDER BY tablename,indexname;
SELECT event_object_table,trigger_name,action_timing,event_manipulation FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY event_object_table,trigger_name;
DO $$
DECLARE settings_id integer;
BEGIN
 SELECT id INTO settings_id FROM public.platform_settings WHERE id=1;
 IF settings_id IS NULL THEN RAISE EXCEPTION 'Expected seeded settings missing'; END IF;
 BEGIN
  UPDATE public.platform_settings SET updated_by_user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid WHERE id=1;
  RAISE EXCEPTION 'FAIL: invalid FK was accepted';
 EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS: platform_settings invalid user FK rejected'; END;
 BEGIN
  INSERT INTO public.platform_settings (id,incident_highlight_hours,incident_unaddressed_days,created_at,updated_at) VALUES (1,48,7,now(),now());
  RAISE EXCEPTION 'FAIL: duplicate primary key accepted';
 EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS: duplicate settings primary key rejected'; END;
END $$;
ROLLBACK;
SELECT count(*) AS settings_count, bool_and(updated_by_user_id IS NULL) AS no_invalid_fk_residue FROM public.platform_settings;
