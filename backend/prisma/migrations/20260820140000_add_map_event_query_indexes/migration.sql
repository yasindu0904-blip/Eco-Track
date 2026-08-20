-- MAP-03 cursor paths: keep public and tenant event discovery bounded without
-- sorting every qualifying event before applying LIMIT.
CREATE INDEX "cleanup_events_organization_updated_id_idx"
ON "public"."cleanup_events" ("organization_id", "updated_at" DESC, "id" DESC);

CREATE INDEX "cleanup_events_public_map_published_idx"
ON "public"."cleanup_events" ("published_at" DESC, "id" DESC)
WHERE "published_at" IS NOT NULL
  AND "lifecycle_status" IN (
    'PUBLISHED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETION_SUBMITTED'
  );
