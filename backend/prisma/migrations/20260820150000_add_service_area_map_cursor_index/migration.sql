-- MAP-03 bounded service-area viewport path: satisfy tenant/status filtering
-- and stable id ordering before the spatial predicate is evaluated.
CREATE INDEX "organization_service_areas_organization_status_id_idx"
ON "public"."organization_service_areas" ("organization_id", "status", "id");
