-- Simplify cleanup events to one start time and event-level participation.
-- Existing session data is used to backfill the new fields before the old
-- session tables are removed.

ALTER TYPE "ContributionType" RENAME VALUE 'SESSION_ATTENDED' TO 'EVENT_ATTENDED';

CREATE TYPE "AttendanceStatus" AS ENUM ('UNMARKED', 'ATTENDED', 'ABSENT');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EVENT_REMINDER';

ALTER TABLE "public"."cleanup_events"
  ADD COLUMN "starts_at" TIMESTAMPTZ(6),
  ADD COLUMN "capacity" INTEGER,
  ADD CONSTRAINT "cleanup_events_capacity_check"
    CHECK ("capacity" IS NULL OR "capacity" > 0);

UPDATE "public"."cleanup_events" AS event
SET
  "starts_at" = source."starts_at",
  "capacity" = source."capacity"
FROM (
  SELECT
    session."cleanup_event_id",
    MIN((session."session_date" + session."start_time") AT TIME ZONE 'Asia/Colombo') AS "starts_at",
    CASE
      WHEN bool_or(session."capacity" IS NULL) THEN NULL
      ELSE SUM(session."capacity")::integer
    END AS "capacity"
  FROM "public"."event_sessions" AS session
  GROUP BY session."cleanup_event_id"
) AS source
WHERE source."cleanup_event_id" = event."id";

-- Published historical events always need a useful display time, even if an
-- old development row did not contain a session.
UPDATE "public"."cleanup_events"
SET "starts_at" = COALESCE("published_at", "created_at")
WHERE "starts_at" IS NULL
  AND "lifecycle_status" <> 'DRAFT';

ALTER TABLE "public"."event_participants"
  ADD COLUMN "attendance_status" "AttendanceStatus" NOT NULL DEFAULT 'UNMARKED',
  ADD COLUMN "attendance_marked_at" TIMESTAMPTZ(6),
  ADD COLUMN "attendance_marked_by_membership_id" UUID,
  ADD CONSTRAINT "event_participants_attendance_details_check" CHECK (
    ("attendance_status" = 'UNMARKED'
      AND "attendance_marked_at" IS NULL
      AND "attendance_marked_by_membership_id" IS NULL)
    OR
    ("attendance_status" IN ('ATTENDED', 'ABSENT')
      AND "attendance_marked_at" IS NOT NULL
      AND "attendance_marked_by_membership_id" IS NOT NULL)
  ),
  ADD CONSTRAINT "event_participants_attendance_marker_fkey"
    FOREIGN KEY ("attendance_marked_by_membership_id")
    REFERENCES "public"."organization_memberships"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

WITH ranked_attendance AS (
  SELECT
    allocation."participant_id",
    allocation."status",
    allocation."attendance_marked_at",
    allocation."attendance_marked_by_membership_id",
    ROW_NUMBER() OVER (
      PARTITION BY allocation."participant_id"
      ORDER BY
        CASE allocation."status" WHEN 'ATTENDED' THEN 0 WHEN 'ABSENT' THEN 1 ELSE 2 END,
        allocation."attendance_marked_at" DESC NULLS LAST,
        allocation."id"
    ) AS row_number
  FROM "public"."session_allocations" AS allocation
  WHERE allocation."status" IN ('ATTENDED', 'ABSENT')
)
UPDATE "public"."event_participants" AS participant
SET
  "attendance_status" = ranked."status"::text::"AttendanceStatus",
  "attendance_marked_at" = ranked."attendance_marked_at",
  "attendance_marked_by_membership_id" = ranked."attendance_marked_by_membership_id"
FROM ranked_attendance AS ranked
WHERE ranked."row_number" = 1
  AND ranked."participant_id" = participant."id";

CREATE INDEX "event_participants_event_attendance_idx"
ON "public"."event_participants" ("cleanup_event_id", "attendance_status");

DROP TRIGGER IF EXISTS "event_evidence_validate_session" ON "public"."event_evidence";
DROP FUNCTION IF EXISTS "public"."validate_event_evidence_session"();

ALTER TABLE "public"."event_evidence"
  DROP CONSTRAINT IF EXISTS "event_evidence_session_id_fkey",
  DROP COLUMN "session_id";

ALTER TABLE "public"."contribution_events"
  ADD COLUMN "event_participant_id" UUID;

UPDATE "public"."contribution_events" AS contribution
SET "event_participant_id" = allocation."participant_id"
FROM "public"."session_allocations" AS allocation
WHERE contribution."session_allocation_id" = allocation."id"
  AND contribution."type" = 'EVENT_ATTENDED';

ALTER TABLE "public"."contribution_events"
  ADD CONSTRAINT "contribution_events_event_participant_id_fkey"
    FOREIGN KEY ("event_participant_id")
    REFERENCES "public"."event_participants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  DROP CONSTRAINT "contribution_events_source_check";

ALTER TABLE "public"."contribution_events"
  ADD CONSTRAINT "contribution_events_source_check" CHECK (
    (
      "type" = 'VERIFIED_INCIDENT_REPORT'
      AND "incident_id" IS NOT NULL
      AND "event_participant_id" IS NULL
      AND "cleanup_event_id" IS NULL
      AND "source_key" IS NULL
    )
    OR (
      "type" = 'EVENT_ATTENDED'
      AND "incident_id" IS NULL
      AND "event_participant_id" IS NOT NULL
      AND "cleanup_event_id" IS NULL
      AND "source_key" IS NULL
    )
    OR (
      "type" = 'EVENT_COMPLETED'
      AND "incident_id" IS NULL
      AND "event_participant_id" IS NULL
      AND "cleanup_event_id" IS NOT NULL
      AND "source_key" IS NULL
    )
    OR (
      "type" = 'SPECIAL_CONTRIBUTION'
      AND "incident_id" IS NULL
      AND "event_participant_id" IS NULL
      AND "cleanup_event_id" IS NULL
      AND "source_key" IS NOT NULL
      AND length(btrim("source_key")) BETWEEN 1 AND 200
    )
  );

DROP INDEX IF EXISTS "public"."contribution_events_session_attendance_once_idx";
CREATE UNIQUE INDEX "contribution_events_event_attendance_once_idx"
ON "public"."contribution_events" ("user_id", "type", "event_participant_id")
WHERE "type" = 'EVENT_ATTENDED';

-- The event-level attendance record is now the permanent reward source. Once
-- existing contribution rows have been backfilled, the session model can be
-- removed completely rather than retained as dead compatibility storage.
ALTER TABLE "public"."contribution_events"
  DROP CONSTRAINT IF EXISTS "contribution_events_session_allocation_id_fkey",
  DROP COLUMN "session_allocation_id";

DROP FUNCTION IF EXISTS "public"."validate_participant_session_pair"() CASCADE;
DROP FUNCTION IF EXISTS "public"."validate_session_allocation_context"() CASCADE;
DROP TABLE "public"."participant_session_availability";
DROP TABLE "public"."session_allocations";
DROP TABLE "public"."event_sessions";
DROP TYPE "SessionStatus";
DROP TYPE "AllocationStatus";

ALTER TABLE "public"."notifications"
  ADD COLUMN "deduplication_key" TEXT;

CREATE UNIQUE INDEX "notifications_deduplication_key_key"
ON "public"."notifications" ("deduplication_key");

CREATE TABLE "public"."cleanup_event_reminders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cleanup_event_id" UUID NOT NULL,
  "scheduled_for" TIMESTAMPTZ(6) NOT NULL,
  "processed_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cleanup_event_reminders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cleanup_event_reminders_cleanup_event_id_fkey"
    FOREIGN KEY ("cleanup_event_id") REFERENCES "public"."cleanup_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cleanup_event_reminders_state_check"
    CHECK (NOT ("processed_at" IS NOT NULL AND "cancelled_at" IS NOT NULL))
);

CREATE UNIQUE INDEX "cleanup_event_reminders_cleanup_event_id_key"
ON "public"."cleanup_event_reminders" ("cleanup_event_id");

CREATE INDEX "cleanup_event_reminders_due_idx"
ON "public"."cleanup_event_reminders" ("processed_at", "cancelled_at", "scheduled_for");

INSERT INTO "public"."cleanup_event_reminders"
  ("cleanup_event_id", "scheduled_for", "created_at", "updated_at")
SELECT event."id", event."starts_at" - INTERVAL '30 minutes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "public"."cleanup_events" AS event
WHERE event."lifecycle_status" IN ('PUBLISHED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETION_SUBMITTED')
  AND event."starts_at" > CURRENT_TIMESTAMP + INTERVAL '30 minutes'
ON CONFLICT ("cleanup_event_id") DO NOTHING;

ALTER TABLE "public"."cleanup_event_reminders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."cleanup_event_reminders" FROM anon, authenticated;

CREATE INDEX "cleanup_events_lifecycle_starts_at_idx"
ON "public"."cleanup_events" ("lifecycle_status", "starts_at");

-- Old intermediate lifecycle rows become published events. Historical workflow
-- rows remain available for old audit history but are no longer active choices.
UPDATE "public"."cleanup_workflow_statuses"
SET "mapped_lifecycle_status" = 'PUBLISHED', "is_active" = false
WHERE "mapped_lifecycle_status" IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETION_SUBMITTED');

UPDATE "public"."cleanup_events" AS event
SET
  "lifecycle_status" = 'PUBLISHED',
  "current_workflow_status_id" = canonical."id"
FROM "public"."cleanup_workflow_statuses" AS canonical
WHERE event."lifecycle_status" IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETION_SUBMITTED')
  AND canonical."organization_id" = event."organization_id"
  AND canonical."mapped_lifecycle_status" = 'PUBLISHED'
  AND canonical."is_active" = true;

DELETE FROM "public"."cleanup_workflow_transitions"
WHERE "from_status_id" IN (
    SELECT "id" FROM "public"."cleanup_workflow_statuses" WHERE "is_active" = false
  )
   OR "to_status_id" IN (
    SELECT "id" FROM "public"."cleanup_workflow_statuses" WHERE "is_active" = false
  );

INSERT INTO "public"."cleanup_workflow_transitions"
  ("id", "organization_id", "from_status_id", "to_status_id")
SELECT gen_random_uuid(), organization."id", from_status."id", to_status."id"
FROM "public"."organizations" AS organization
JOIN "public"."cleanup_workflow_statuses" AS from_status
  ON from_status."organization_id" = organization."id"
 AND from_status."mapped_lifecycle_status" = 'PUBLISHED'
 AND from_status."is_active" = true
JOIN "public"."cleanup_workflow_statuses" AS to_status
  ON to_status."organization_id" = organization."id"
 AND to_status."mapped_lifecycle_status" IN ('COMPLETED', 'CANCELLED')
 AND to_status."is_active" = true
ON CONFLICT ("organization_id", "from_status_id", "to_status_id") DO NOTHING;

DROP INDEX IF EXISTS "public"."cleanup_events_one_active_incident_claim_idx";
CREATE UNIQUE INDEX "cleanup_events_one_active_incident_claim_idx"
ON "public"."cleanup_events" ("incident_id")
WHERE "incident_id" IS NOT NULL AND "lifecycle_status" = 'PUBLISHED';

CREATE OR REPLACE FUNCTION "public"."create_default_cleanup_workflow"(p_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "public"."cleanup_workflow_statuses"
    WHERE "organization_id" = p_organization_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO "public"."cleanup_workflow_statuses" (
    "id", "organization_id", "code", "label", "mapped_lifecycle_status",
    "position", "is_initial", "is_final", "created_at", "updated_at"
  ) VALUES
    (gen_random_uuid(), p_organization_id, 'DRAFT', 'Draft', 'DRAFT', 0, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), p_organization_id, 'PUBLISHED', 'Published', 'PUBLISHED', 1, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), p_organization_id, 'COMPLETED', 'Completed', 'COMPLETED', 2, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), p_organization_id, 'CANCELLED', 'Cancelled', 'CANCELLED', 3, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

  INSERT INTO "public"."cleanup_workflow_transitions" (
    "id", "organization_id", "from_status_id", "to_status_id"
  )
  SELECT gen_random_uuid(), p_organization_id, from_status."id", to_status."id"
  FROM (VALUES
      ('DRAFT', 'PUBLISHED'),
      ('PUBLISHED', 'COMPLETED'),
      ('PUBLISHED', 'CANCELLED')
    ) AS transition("from_code", "to_code")
  JOIN "public"."cleanup_workflow_statuses" AS from_status
    ON from_status."organization_id" = p_organization_id
   AND from_status."code" = transition."from_code"
  JOIN "public"."cleanup_workflow_statuses" AS to_status
    ON to_status."organization_id" = p_organization_id
   AND to_status."code" = transition."to_code";
END;
$$;
