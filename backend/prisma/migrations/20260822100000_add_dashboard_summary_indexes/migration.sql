CREATE INDEX IF NOT EXISTS "incidents_reporter_status_reported_idx"
  ON "incidents" ("reporter_user_id", "status", "reported_at");

DROP INDEX IF EXISTS "incidents_reporter_user_id_idx";

CREATE INDEX IF NOT EXISTS "event_participants_user_status_joined_idx"
  ON "event_participants" ("user_id", "status", "joined_at");

DROP INDEX IF EXISTS "event_participants_user_status_idx";
