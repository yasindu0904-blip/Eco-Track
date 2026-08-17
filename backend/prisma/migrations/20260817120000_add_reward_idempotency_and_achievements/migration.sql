-- Preserve the stable approval source used to make special-contribution retries idempotent.
ALTER TABLE "public"."contribution_events"
ADD COLUMN "source_key" TEXT;

ALTER TABLE "public"."contribution_events"
DROP CONSTRAINT "contribution_events_source_check";

ALTER TABLE "public"."contribution_events"
ADD CONSTRAINT "contribution_events_source_check" CHECK (
  (
    "type" = 'VERIFIED_INCIDENT_REPORT'
    AND "incident_id" IS NOT NULL
    AND "session_allocation_id" IS NULL
    AND "cleanup_event_id" IS NULL
    AND "source_key" IS NULL
  )
  OR (
    "type" = 'SESSION_ATTENDED'
    AND "incident_id" IS NULL
    AND "session_allocation_id" IS NOT NULL
    AND "cleanup_event_id" IS NULL
    AND "source_key" IS NULL
  )
  OR (
    "type" = 'EVENT_COMPLETED'
    AND "incident_id" IS NULL
    AND "session_allocation_id" IS NULL
    AND "cleanup_event_id" IS NOT NULL
    AND "source_key" IS NULL
  )
  OR (
    "type" = 'SPECIAL_CONTRIBUTION'
    AND "incident_id" IS NULL
    AND "session_allocation_id" IS NULL
    AND "cleanup_event_id" IS NULL
    AND "source_key" IS NOT NULL
    AND length(btrim("source_key")) BETWEEN 1 AND 200
  )
);

CREATE UNIQUE INDEX "contribution_events_special_source_once_idx"
ON "public"."contribution_events" ("user_id", "type", "source_key")
WHERE "type" = 'SPECIAL_CONTRIBUTION';

-- Contribution records are the permanent explanation for points and achievements.
ALTER TABLE "public"."contribution_events"
DROP CONSTRAINT "contribution_events_incident_id_fkey",
ADD CONSTRAINT "contribution_events_incident_id_fkey"
  FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
DROP CONSTRAINT "contribution_events_session_allocation_id_fkey",
ADD CONSTRAINT "contribution_events_session_allocation_id_fkey"
  FOREIGN KEY ("session_allocation_id") REFERENCES "public"."session_allocations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
DROP CONSTRAINT "contribution_events_cleanup_event_id_fkey",
ADD CONSTRAINT "contribution_events_cleanup_event_id_fkey"
  FOREIGN KEY ("cleanup_event_id") REFERENCES "public"."cleanup_events"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."user_achievements"
DROP CONSTRAINT "user_achievements_awarded_from_contribution_id_fkey",
ADD CONSTRAINT "user_achievements_awarded_from_contribution_id_fkey"
  FOREIGN KEY ("awarded_from_contribution_id")
  REFERENCES "public"."contribution_events"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed deterministic MVP achievement definitions in every migrated environment.
INSERT INTO "public"."achievement_definitions"
  ("id", "code", "name", "description", "threshold_points", "highlight_on_map", "is_active")
VALUES
  ('00000000-0000-4000-9000-000000000020', 'GREEN_STARTER', 'Green Starter', 'Earned after reaching 20 verified EcoTrack contribution points.', 20, false, true),
  ('00000000-0000-4000-9000-000000000100', 'COMMUNITY_HELPER', 'Community Helper', 'Earned after reaching 100 verified EcoTrack contribution points.', 100, false, true),
  ('00000000-0000-4000-9000-000000000500', 'ECO_CHAMPION', 'Eco Champion', 'Earned after reaching 500 verified EcoTrack contribution points.', 500, true, true)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "threshold_points" = EXCLUDED."threshold_points",
  "highlight_on_map" = EXCLUDED."highlight_on_map",
  "is_active" = true;
