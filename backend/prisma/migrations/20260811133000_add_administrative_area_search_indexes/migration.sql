-- The API uses case-insensitive substring searches (ILIKE '%term%').
-- Trigram GIN indexes support that search shape; ordinary B-tree indexes do not.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX "administrative_areas_name_en_trgm_idx"
ON "administrative_areas"
USING GIN ("name_en" extensions.gin_trgm_ops);

CREATE INDEX "administrative_areas_ds_name_trgm_idx"
ON "administrative_areas"
USING GIN ("divisional_secretariat_name" extensions.gin_trgm_ops);

CREATE INDEX "administrative_areas_district_name_trgm_idx"
ON "administrative_areas"
USING GIN ("district_name" extensions.gin_trgm_ops);

CREATE INDEX "administrative_areas_official_code_trgm_idx"
ON "administrative_areas"
USING GIN ("official_code" extensions.gin_trgm_ops);
