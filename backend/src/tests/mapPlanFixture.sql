-- Synthetic planner fixture; use only the disposable local map-check database.
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'ecotrack_map_check' THEN
    RAISE EXCEPTION 'This fixture requires ecotrack_map_check';
  END IF;
END $$;

INSERT INTO user_profiles (id, auth_user_id, email, full_name, updated_at)
VALUES ('10000000-0000-4000-8000-000000000001', gen_random_uuid(),
        'map-plan@example.com', 'Synthetic Map Plan User', now());

INSERT INTO organizations (id, requested_by_user_id, name, slug, official_email,
                          official_phone, official_address, status, updated_at)
VALUES ('10000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000001', 'Synthetic Map Plan Organization',
        'synthetic-map-plan', 'map-plan-org@example.com', '+94 70 000 0000',
        'Synthetic fixture', 'ACTIVE', now());

INSERT INTO organization_memberships (id, organization_id, user_id, role, status, source)
VALUES ('10000000-0000-4000-8000-000000000003',
        '10000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000001', 'ORG_ADMIN', 'ACTIVE', 'FIRST_ADMIN');

INSERT INTO administrative_areas (id, official_code, name_en, boundary, source_name, updated_at)
SELECT gen_random_uuid(), 'SYNTHETIC-' || n, 'Synthetic GN ' || n,
       extensions.ST_Multi(extensions.ST_MakeEnvelope(
         79.85 + (n % 200) * 0.002, 6.92 + (n / 200) * 0.002,
         79.87 + (n % 200) * 0.002, 6.94 + (n / 200) * 0.002, 4326))::extensions.geography,
       'Synthetic local planner fixture', now()
FROM generate_series(1, 13844) AS n;

INSERT INTO organization_service_areas (id, organization_id, administrative_area_id,
                                      status, updated_at)
SELECT gen_random_uuid(), '10000000-0000-4000-8000-000000000002', id, 'ACTIVE', now()
FROM administrative_areas ORDER BY official_code LIMIT 51;

INSERT INTO incidents (id, submission_id, reporter_user_id, category_id, title, description,
                       severity, latitude, longitude, highlight_until, archive_after, updated_at)
SELECT gen_random_uuid(), gen_random_uuid(), '10000000-0000-4000-8000-000000000001', category.id,
       'Synthetic incident ' || n, 'Local query planner fixture', 'LOW',
       CASE WHEN n <= 32 THEN 6.9271 + (n % 8) * 0.001 ELSE 8.0 + (n % 100) * 0.001 END,
       CASE WHEN n <= 32 THEN 79.8612 + (n / 8) * 0.001 ELSE 80.5 + (n / 100) * 0.001 END,
       now() + interval '2 days', now() + interval '7 days', now()
FROM generate_series(1, 2000) AS n
CROSS JOIN (SELECT id FROM incident_categories WHERE is_active LIMIT 1) AS category;

INSERT INTO cleanup_events (id, organization_id, current_workflow_status_id,
                           created_by_membership_id, title, description,
                           lifecycle_status, event_latitude, event_longitude,
                           starts_at, published_at, updated_at)
SELECT gen_random_uuid(), '10000000-0000-4000-8000-000000000002',
       workflow.id, '10000000-0000-4000-8000-000000000003',
       'Synthetic event ' || n, 'Local query planner fixture', 'PUBLISHED',
       CASE WHEN n <= 41 THEN 6.9271 + (n % 8) * 0.001 ELSE 8.0 + (n % 100) * 0.001 END,
       CASE WHEN n <= 41 THEN 79.8612 + (n / 8) * 0.001 ELSE 80.5 + (n / 100) * 0.001 END,
       now() + interval '1 day', now() - n * interval '1 minute', now()
FROM generate_series(1, 2000) AS n
CROSS JOIN (SELECT id FROM cleanup_workflow_statuses
            WHERE organization_id = '10000000-0000-4000-8000-000000000002'
              AND code = 'PUBLISHED') AS workflow;

ANALYZE;
COMMIT;
