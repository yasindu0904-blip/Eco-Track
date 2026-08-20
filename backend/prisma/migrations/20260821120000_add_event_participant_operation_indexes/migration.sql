-- EVT-05 participant operations: support stable event participant paging and
-- session-capacity checks without scanning unrelated events or sessions.
CREATE INDEX IF NOT EXISTS "event_participants_event_status_joined_id_idx"
ON "public"."event_participants" (
  "cleanup_event_id",
  "status",
  "joined_at" DESC,
  "id" DESC
);

CREATE INDEX IF NOT EXISTS "session_allocations_session_status_idx"
ON "public"."session_allocations" ("session_id", "status");
