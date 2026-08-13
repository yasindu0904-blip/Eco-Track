-- EcoTrack incident, organization workflow, cleanup-event, participation, and
-- contribution foundation. PostGIS is installed in the Supabase-compatible
-- extensions schema by the target environment before this migration runs.

BEGIN;

CREATE TYPE "IncidentSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "IncidentStatus" AS ENUM (
  'ACTIVE',
  'CLEANUP_ORGANIZED',
  'RESOLVED',
  'EXPIRED',
  'ARCHIVED'
);

CREATE TYPE "IncidentReviewStatus" AS ENUM (
  'VIEWED',
  'VALID',
  'FALSE'
);

CREATE TYPE "CleanupLifecycleStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETION_SUBMITTED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "SessionStatus" AS ENUM (
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "ParticipantStatus" AS ENUM (
  'JOINED',
  'WITHDRAWN',
  'REMOVED'
);

CREATE TYPE "AllocationStatus" AS ENUM (
  'PLANNED',
  'ATTENDED',
  'ABSENT',
  'REMOVED'
);

CREATE TYPE "NoteVisibility" AS ENUM (
  'PARTICIPANTS',
  'INTERNAL'
);

CREATE TYPE "EvidenceType" AS ENUM (
  'BEFORE',
  'PROGRESS',
  'AFTER'
);

CREATE TYPE "ContributionType" AS ENUM (
  'VERIFIED_INCIDENT_REPORT',
  'SESSION_ATTENDED',
  'EVENT_COMPLETED',
  'SPECIAL_CONTRIBUTION'
);

CREATE TABLE "public"."cleanup_workflow_statuses" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "mapped_lifecycle_status" "CleanupLifecycleStatus" NOT NULL,
  "position" INTEGER NOT NULL,
  "is_initial" BOOLEAN NOT NULL DEFAULT false,
  "is_final" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "cleanup_workflow_statuses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cleanup_workflow_statuses_position_check" CHECK ("position" >= 0)
);

CREATE TABLE "public"."cleanup_workflow_transitions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "from_status_id" UUID NOT NULL,
  "to_status_id" UUID NOT NULL,

  CONSTRAINT "cleanup_workflow_transitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cleanup_workflow_transitions_distinct_status_check"
    CHECK ("from_status_id" <> "to_status_id")
);

CREATE TABLE "public"."incidents" (
  "id" UUID NOT NULL,
  "reporter_user_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "IncidentSeverity" NOT NULL,
  "status" "IncidentStatus" NOT NULL DEFAULT 'ACTIVE',
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "geo_point" extensions.geography(Point,4326) NOT NULL
    DEFAULT extensions.ST_GeogFromText('SRID=4326;POINT(0 0)'),
  "address_text" TEXT,
  "highlight_until" TIMESTAMPTZ(6) NOT NULL,
  "archive_after" TIMESTAMPTZ(6) NOT NULL,
  "reported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "resolved_at" TIMESTAMPTZ(6),
  "archived_at" TIMESTAMPTZ(6),

  CONSTRAINT "incidents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "incidents_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
  CONSTRAINT "incidents_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180),
  CONSTRAINT "incidents_deadline_order_check"
    CHECK ("highlight_until" > "reported_at" AND "archive_after" > "highlight_until")
);

CREATE TABLE "public"."incident_photos" (
  "id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "storage_path" TEXT NOT NULL,
  "thumbnail_path" TEXT,
  "caption" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "incident_photos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "incident_photos_sort_order_check" CHECK ("sort_order" >= 0)
);

CREATE TABLE "public"."incident_reviews" (
  "id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "status" "IncidentReviewStatus" NOT NULL,
  "reason_code" TEXT,
  "private_notes" TEXT,
  "reviewed_by_membership_id" UUID NOT NULL,
  "first_viewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "incident_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."incident_status_history" (
  "id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "from_status" "IncidentStatus",
  "to_status" "IncidentStatus" NOT NULL,
  "changed_by_user_id" UUID,
  "related_cleanup_event_id" UUID,
  "reason" TEXT,
  "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "incident_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."cleanup_events" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "incident_id" UUID,
  "current_workflow_status_id" UUID NOT NULL,
  "lifecycle_status" "CleanupLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  "created_by_membership_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "public_instructions" TEXT,
  "event_latitude" DECIMAL(9,6) NOT NULL,
  "event_longitude" DECIMAL(9,6) NOT NULL,
  "event_geo_point" extensions.geography(Point,4326) NOT NULL
    DEFAULT extensions.ST_GeogFromText('SRID=4326;POINT(0 0)'),
  "event_address" TEXT,
  "meeting_latitude" DECIMAL(9,6),
  "meeting_longitude" DECIMAL(9,6),
  "meeting_geo_point" extensions.geography(Point,4326),
  "meeting_address" TEXT,
  "published_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "cancellation_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "cleanup_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cleanup_events_event_latitude_check" CHECK ("event_latitude" BETWEEN -90 AND 90),
  CONSTRAINT "cleanup_events_event_longitude_check" CHECK ("event_longitude" BETWEEN -180 AND 180),
  CONSTRAINT "cleanup_events_meeting_latitude_check"
    CHECK ("meeting_latitude" IS NULL OR "meeting_latitude" BETWEEN -90 AND 90),
  CONSTRAINT "cleanup_events_meeting_longitude_check"
    CHECK ("meeting_longitude" IS NULL OR "meeting_longitude" BETWEEN -180 AND 180),
  CONSTRAINT "cleanup_events_meeting_coordinate_pair_check"
    CHECK (("meeting_latitude" IS NULL) = ("meeting_longitude" IS NULL)),
  CONSTRAINT "cleanup_events_cancellation_fields_check"
    CHECK (
      "lifecycle_status" <> 'CANCELLED'
      OR ("cancelled_at" IS NOT NULL AND "cancellation_reason" IS NOT NULL)
    ),
  CONSTRAINT "cleanup_events_completion_fields_check"
    CHECK ("lifecycle_status" <> 'COMPLETED' OR "completed_at" IS NOT NULL),
  CONSTRAINT "cleanup_events_publication_fields_check"
    CHECK (
      "lifecycle_status" NOT IN (
        'PUBLISHED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETION_SUBMITTED', 'COMPLETED'
      )
      OR "published_at" IS NOT NULL
    )
);

CREATE TABLE "public"."event_sessions" (
  "id" UUID NOT NULL,
  "cleanup_event_id" UUID NOT NULL,
  "session_date" DATE NOT NULL,
  "start_time" TIME(6) NOT NULL,
  "end_time" TIME(6) NOT NULL,
  "capacity" INTEGER,
  "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "location_latitude" DECIMAL(9,6),
  "location_longitude" DECIMAL(9,6),
  "location_geo_point" extensions.geography(Point,4326),
  "location_address" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "event_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_sessions_time_check" CHECK ("end_time" > "start_time"),
  CONSTRAINT "event_sessions_capacity_check" CHECK ("capacity" IS NULL OR "capacity" > 0),
  CONSTRAINT "event_sessions_location_latitude_check"
    CHECK ("location_latitude" IS NULL OR "location_latitude" BETWEEN -90 AND 90),
  CONSTRAINT "event_sessions_location_longitude_check"
    CHECK ("location_longitude" IS NULL OR "location_longitude" BETWEEN -180 AND 180),
  CONSTRAINT "event_sessions_location_coordinate_pair_check"
    CHECK (("location_latitude" IS NULL) = ("location_longitude" IS NULL))
);

CREATE TABLE "public"."event_coordinators" (
  "id" UUID NOT NULL,
  "cleanup_event_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "assigned_by_membership_id" UUID NOT NULL,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removed_at" TIMESTAMPTZ(6),

  CONSTRAINT "event_coordinators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."event_participants" (
  "id" UUID NOT NULL,
  "cleanup_event_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "ParticipantStatus" NOT NULL DEFAULT 'JOINED',
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawn_at" TIMESTAMPTZ(6),
  "removed_at" TIMESTAMPTZ(6),
  "removed_by_membership_id" UUID,
  "removal_reason" TEXT,

  CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_participants_status_details_check" CHECK (
    ("status" = 'JOINED' AND "withdrawn_at" IS NULL AND "removed_at" IS NULL)
    OR ("status" = 'WITHDRAWN' AND "withdrawn_at" IS NOT NULL AND "removed_at" IS NULL)
    OR (
      "status" = 'REMOVED'
      AND "removed_at" IS NOT NULL
      AND "removed_by_membership_id" IS NOT NULL
      AND "removal_reason" IS NOT NULL
    )
  )
);

CREATE TABLE "public"."participant_session_availability" (
  "participant_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "marked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "participant_session_availability_pkey"
    PRIMARY KEY ("participant_id", "session_id")
);

CREATE TABLE "public"."session_allocations" (
  "id" UUID NOT NULL,
  "participant_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "allocated_by_membership_id" UUID NOT NULL,
  "status" "AllocationStatus" NOT NULL DEFAULT 'PLANNED',
  "allocated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attendance_marked_by_membership_id" UUID,
  "attendance_marked_at" TIMESTAMPTZ(6),
  "notes" TEXT,

  CONSTRAINT "session_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "session_allocations_attendance_details_check" CHECK (
    ("status" = 'PLANNED' AND "attendance_marked_at" IS NULL AND "attendance_marked_by_membership_id" IS NULL)
    OR (
      "status" IN ('ATTENDED', 'ABSENT', 'REMOVED')
      AND "attendance_marked_at" IS NOT NULL
      AND "attendance_marked_by_membership_id" IS NOT NULL
    )
  )
);

CREATE TABLE "public"."event_notes" (
  "id" UUID NOT NULL,
  "cleanup_event_id" UUID NOT NULL,
  "author_membership_id" UUID NOT NULL,
  "visibility" "NoteVisibility" NOT NULL DEFAULT 'PARTICIPANTS',
  "note_text" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6),

  CONSTRAINT "event_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."event_evidence" (
  "id" UUID NOT NULL,
  "cleanup_event_id" UUID NOT NULL,
  "session_id" UUID,
  "uploaded_by_user_id" UUID NOT NULL,
  "type" "EvidenceType" NOT NULL,
  "storage_path" TEXT NOT NULL,
  "thumbnail_path" TEXT,
  "caption" TEXT,
  "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "event_evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."event_status_history" (
  "id" UUID NOT NULL,
  "cleanup_event_id" UUID NOT NULL,
  "from_workflow_status_id" UUID,
  "to_workflow_status_id" UUID NOT NULL,
  "changed_by_membership_id" UUID NOT NULL,
  "notes" TEXT,
  "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "event_status_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_status_history_distinct_status_check"
    CHECK (
      "from_workflow_status_id" IS NULL
      OR "from_workflow_status_id" <> "to_workflow_status_id"
    )
);

CREATE TABLE "public"."contribution_events" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "type" "ContributionType" NOT NULL,
  "incident_id" UUID,
  "session_allocation_id" UUID,
  "cleanup_event_id" UUID,
  "points" INTEGER NOT NULL,
  "recorded_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contribution_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contribution_events_points_check" CHECK ("points" > 0),
  CONSTRAINT "contribution_events_source_check" CHECK (
    (
      "type" = 'VERIFIED_INCIDENT_REPORT'
      AND "incident_id" IS NOT NULL
      AND "session_allocation_id" IS NULL
      AND "cleanup_event_id" IS NULL
    )
    OR (
      "type" = 'SESSION_ATTENDED'
      AND "incident_id" IS NULL
      AND "session_allocation_id" IS NOT NULL
      AND "cleanup_event_id" IS NULL
    )
    OR (
      "type" = 'EVENT_COMPLETED'
      AND "incident_id" IS NULL
      AND "session_allocation_id" IS NULL
      AND "cleanup_event_id" IS NOT NULL
    )
    OR (
      "type" = 'SPECIAL_CONTRIBUTION'
      AND "incident_id" IS NULL
      AND "session_allocation_id" IS NULL
      AND "cleanup_event_id" IS NULL
    )
  )
);

CREATE TABLE "public"."achievement_definitions" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "threshold_points" INTEGER,
  "highlight_on_map" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "achievement_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "achievement_definitions_threshold_check"
    CHECK ("threshold_points" IS NULL OR "threshold_points" > 0)
);

CREATE TABLE "public"."user_achievements" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "achievement_id" UUID NOT NULL,
  "awarded_from_contribution_id" UUID,
  "awarded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cleanup_workflow_statuses_organization_id_code_key"
ON "public"."cleanup_workflow_statuses" ("organization_id", "code");

CREATE UNIQUE INDEX "cleanup_workflow_statuses_organization_id_position_key"
ON "public"."cleanup_workflow_statuses" ("organization_id", "position");

CREATE UNIQUE INDEX "cleanup_workflow_statuses_organization_id_id_key"
ON "public"."cleanup_workflow_statuses" ("organization_id", "id");

CREATE UNIQUE INDEX "cleanup_workflow_transitions_organization_from_to_key"
ON "public"."cleanup_workflow_transitions" (
  "organization_id", "from_status_id", "to_status_id"
);

CREATE INDEX "incidents_status_reported_at_idx"
ON "public"."incidents" ("status", "reported_at");

CREATE INDEX "incidents_category_id_idx"
ON "public"."incidents" ("category_id");

CREATE INDEX "incidents_reporter_user_id_idx"
ON "public"."incidents" ("reporter_user_id");

CREATE INDEX "incidents_geo_point_gist_idx"
ON "public"."incidents" USING GIST ("geo_point");

CREATE INDEX "incident_photos_incident_id_sort_order_idx"
ON "public"."incident_photos" ("incident_id", "sort_order");

CREATE UNIQUE INDEX "incident_reviews_incident_id_organization_id_key"
ON "public"."incident_reviews" ("incident_id", "organization_id");

CREATE INDEX "incident_reviews_incident_id_status_idx"
ON "public"."incident_reviews" ("incident_id", "status");

CREATE INDEX "incident_reviews_organization_status_updated_idx"
ON "public"."incident_reviews" ("organization_id", "status", "updated_at");

CREATE INDEX "incident_status_history_incident_changed_at_idx"
ON "public"."incident_status_history" ("incident_id", "changed_at");

CREATE UNIQUE INDEX "cleanup_events_organization_id_id_key"
ON "public"."cleanup_events" ("organization_id", "id");

CREATE INDEX "cleanup_events_incident_id_idx"
ON "public"."cleanup_events" ("incident_id");

CREATE INDEX "cleanup_events_organization_lifecycle_created_idx"
ON "public"."cleanup_events" (
  "organization_id", "lifecycle_status", "created_at"
);

CREATE INDEX "cleanup_events_event_geo_point_gist_idx"
ON "public"."cleanup_events" USING GIST ("event_geo_point");

CREATE INDEX "cleanup_events_meeting_geo_point_gist_idx"
ON "public"."cleanup_events" USING GIST ("meeting_geo_point");

CREATE UNIQUE INDEX "cleanup_events_one_active_incident_claim_idx"
ON "public"."cleanup_events" ("incident_id")
WHERE "incident_id" IS NOT NULL
  AND "lifecycle_status" IN (
    'PUBLISHED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETION_SUBMITTED'
  );

CREATE UNIQUE INDEX "event_sessions_event_date_start_key"
ON "public"."event_sessions" ("cleanup_event_id", "session_date", "start_time");

CREATE UNIQUE INDEX "event_sessions_event_id_key"
ON "public"."event_sessions" ("cleanup_event_id", "id");

CREATE INDEX "event_sessions_date_status_idx"
ON "public"."event_sessions" ("session_date", "status");

CREATE INDEX "event_sessions_location_geo_point_gist_idx"
ON "public"."event_sessions" USING GIST ("location_geo_point");

CREATE UNIQUE INDEX "event_coordinators_event_membership_key"
ON "public"."event_coordinators" ("cleanup_event_id", "membership_id");

CREATE INDEX "event_coordinators_membership_removed_at_idx"
ON "public"."event_coordinators" ("membership_id", "removed_at");

CREATE UNIQUE INDEX "event_participants_event_user_key"
ON "public"."event_participants" ("cleanup_event_id", "user_id");

CREATE UNIQUE INDEX "event_participants_event_id_key"
ON "public"."event_participants" ("cleanup_event_id", "id");

CREATE INDEX "event_participants_user_status_idx"
ON "public"."event_participants" ("user_id", "status");

CREATE UNIQUE INDEX "session_allocations_participant_session_key"
ON "public"."session_allocations" ("participant_id", "session_id");

CREATE INDEX "event_notes_event_visibility_created_idx"
ON "public"."event_notes" ("cleanup_event_id", "visibility", "created_at");

CREATE INDEX "event_evidence_event_uploaded_at_idx"
ON "public"."event_evidence" ("cleanup_event_id", "uploaded_at");

CREATE INDEX "event_status_history_event_changed_at_idx"
ON "public"."event_status_history" ("cleanup_event_id", "changed_at");

CREATE INDEX "contribution_events_user_created_at_idx"
ON "public"."contribution_events" ("user_id", "created_at");

CREATE UNIQUE INDEX "contribution_events_verified_incident_once_idx"
ON "public"."contribution_events" ("user_id", "type", "incident_id")
WHERE "type" = 'VERIFIED_INCIDENT_REPORT';

CREATE UNIQUE INDEX "contribution_events_session_attendance_once_idx"
ON "public"."contribution_events" ("user_id", "type", "session_allocation_id")
WHERE "type" = 'SESSION_ATTENDED';

CREATE UNIQUE INDEX "contribution_events_event_completion_once_idx"
ON "public"."contribution_events" ("user_id", "type", "cleanup_event_id")
WHERE "type" = 'EVENT_COMPLETED';

CREATE UNIQUE INDEX "achievement_definitions_code_key"
ON "public"."achievement_definitions" ("code");

CREATE UNIQUE INDEX "user_achievements_user_achievement_key"
ON "public"."user_achievements" ("user_id", "achievement_id");

ALTER TABLE "public"."cleanup_workflow_statuses"
  ADD CONSTRAINT "cleanup_workflow_statuses_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."cleanup_workflow_transitions"
  ADD CONSTRAINT "cleanup_workflow_transitions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "cleanup_workflow_transitions_from_status_fkey"
  FOREIGN KEY ("organization_id", "from_status_id")
  REFERENCES "public"."cleanup_workflow_statuses"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "cleanup_workflow_transitions_to_status_fkey"
  FOREIGN KEY ("organization_id", "to_status_id")
  REFERENCES "public"."cleanup_workflow_statuses"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."incidents"
  ADD CONSTRAINT "incidents_reporter_user_id_fkey"
  FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user_profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "incidents_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "public"."incident_categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."incident_photos"
  ADD CONSTRAINT "incident_photos_incident_id_fkey"
  FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."incident_reviews"
  ADD CONSTRAINT "incident_reviews_incident_id_fkey"
  FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "incident_reviews_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "incident_reviews_reviewed_by_membership_id_fkey"
  FOREIGN KEY ("reviewed_by_membership_id")
  REFERENCES "public"."organization_memberships"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."incident_status_history"
  ADD CONSTRAINT "incident_status_history_incident_id_fkey"
  FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "incident_status_history_changed_by_user_id_fkey"
  FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."user_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."cleanup_events"
  ADD CONSTRAINT "cleanup_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "cleanup_events_incident_id_fkey"
  FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "cleanup_events_current_workflow_status_fkey"
  FOREIGN KEY ("organization_id", "current_workflow_status_id")
  REFERENCES "public"."cleanup_workflow_statuses"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "cleanup_events_created_by_membership_fkey"
  FOREIGN KEY ("organization_id", "created_by_membership_id")
  REFERENCES "public"."organization_memberships"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."incident_status_history"
  ADD CONSTRAINT "incident_status_history_related_cleanup_event_id_fkey"
  FOREIGN KEY ("related_cleanup_event_id") REFERENCES "public"."cleanup_events"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."event_sessions"
  ADD CONSTRAINT "event_sessions_cleanup_event_id_fkey"
  FOREIGN KEY ("cleanup_event_id") REFERENCES "public"."cleanup_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."event_coordinators"
  ADD CONSTRAINT "event_coordinators_cleanup_event_id_fkey"
  FOREIGN KEY ("cleanup_event_id") REFERENCES "public"."cleanup_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "event_coordinators_membership_id_fkey"
  FOREIGN KEY ("membership_id") REFERENCES "public"."organization_memberships"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "event_coordinators_assigned_by_membership_id_fkey"
  FOREIGN KEY ("assigned_by_membership_id")
  REFERENCES "public"."organization_memberships"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."event_participants"
  ADD CONSTRAINT "event_participants_cleanup_event_id_fkey"
  FOREIGN KEY ("cleanup_event_id") REFERENCES "public"."cleanup_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "event_participants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "event_participants_removed_by_membership_id_fkey"
  FOREIGN KEY ("removed_by_membership_id")
  REFERENCES "public"."organization_memberships"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."participant_session_availability"
  ADD CONSTRAINT "participant_session_availability_participant_id_fkey"
  FOREIGN KEY ("participant_id") REFERENCES "public"."event_participants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "participant_session_availability_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "public"."event_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."session_allocations"
  ADD CONSTRAINT "session_allocations_participant_id_fkey"
  FOREIGN KEY ("participant_id") REFERENCES "public"."event_participants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "session_allocations_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "public"."event_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "session_allocations_allocated_by_membership_id_fkey"
  FOREIGN KEY ("allocated_by_membership_id")
  REFERENCES "public"."organization_memberships"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "session_allocations_attendance_marked_by_membership_id_fkey"
  FOREIGN KEY ("attendance_marked_by_membership_id")
  REFERENCES "public"."organization_memberships"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."event_notes"
  ADD CONSTRAINT "event_notes_cleanup_event_id_fkey"
  FOREIGN KEY ("cleanup_event_id") REFERENCES "public"."cleanup_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "event_notes_author_membership_id_fkey"
  FOREIGN KEY ("author_membership_id") REFERENCES "public"."organization_memberships"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."event_evidence"
  ADD CONSTRAINT "event_evidence_cleanup_event_id_fkey"
  FOREIGN KEY ("cleanup_event_id") REFERENCES "public"."cleanup_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "event_evidence_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "public"."event_sessions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "event_evidence_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user_profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."event_status_history"
  ADD CONSTRAINT "event_status_history_cleanup_event_id_fkey"
  FOREIGN KEY ("cleanup_event_id") REFERENCES "public"."cleanup_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "event_status_history_from_workflow_status_id_fkey"
  FOREIGN KEY ("from_workflow_status_id")
  REFERENCES "public"."cleanup_workflow_statuses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "event_status_history_to_workflow_status_id_fkey"
  FOREIGN KEY ("to_workflow_status_id")
  REFERENCES "public"."cleanup_workflow_statuses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "event_status_history_changed_by_membership_id_fkey"
  FOREIGN KEY ("changed_by_membership_id")
  REFERENCES "public"."organization_memberships"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."contribution_events"
  ADD CONSTRAINT "contribution_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "contribution_events_incident_id_fkey"
  FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "contribution_events_session_allocation_id_fkey"
  FOREIGN KEY ("session_allocation_id") REFERENCES "public"."session_allocations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "contribution_events_cleanup_event_id_fkey"
  FOREIGN KEY ("cleanup_event_id") REFERENCES "public"."cleanup_events"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "contribution_events_recorded_by_user_id_fkey"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."user_achievements"
  ADD CONSTRAINT "user_achievements_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "user_achievements_achievement_id_fkey"
  FOREIGN KEY ("achievement_id") REFERENCES "public"."achievement_definitions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "user_achievements_awarded_from_contribution_id_fkey"
  FOREIGN KEY ("awarded_from_contribution_id")
  REFERENCES "public"."contribution_events"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Derive PostGIS points from API-friendly latitude/longitude columns.
CREATE FUNCTION "public"."sync_incident_geo_point"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW."geo_point" := extensions.ST_SetSRID(
    extensions.ST_MakePoint(NEW."longitude"::double precision, NEW."latitude"::double precision),
    4326
  )::extensions.geography;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "incidents_sync_geo_point"
BEFORE INSERT OR UPDATE OF "latitude", "longitude"
ON "public"."incidents"
FOR EACH ROW EXECUTE FUNCTION "public"."sync_incident_geo_point"();

CREATE FUNCTION "public"."sync_cleanup_event_geo_points"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW."event_geo_point" := extensions.ST_SetSRID(
    extensions.ST_MakePoint(
      NEW."event_longitude"::double precision,
      NEW."event_latitude"::double precision
    ),
    4326
  )::extensions.geography;

  IF NEW."meeting_latitude" IS NULL THEN
    NEW."meeting_geo_point" := NULL;
  ELSE
    NEW."meeting_geo_point" := extensions.ST_SetSRID(
      extensions.ST_MakePoint(
        NEW."meeting_longitude"::double precision,
        NEW."meeting_latitude"::double precision
      ),
      4326
    )::extensions.geography;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "cleanup_events_sync_geo_points"
BEFORE INSERT OR UPDATE OF
  "event_latitude", "event_longitude", "meeting_latitude", "meeting_longitude"
ON "public"."cleanup_events"
FOR EACH ROW EXECUTE FUNCTION "public"."sync_cleanup_event_geo_points"();

CREATE FUNCTION "public"."sync_event_session_geo_point"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW."location_latitude" IS NULL THEN
    NEW."location_geo_point" := NULL;
  ELSE
    NEW."location_geo_point" := extensions.ST_SetSRID(
      extensions.ST_MakePoint(
        NEW."location_longitude"::double precision,
        NEW."location_latitude"::double precision
      ),
      4326
    )::extensions.geography;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "event_sessions_sync_geo_point"
BEFORE INSERT OR UPDATE OF "location_latitude", "location_longitude"
ON "public"."event_sessions"
FOR EACH ROW EXECUTE FUNCTION "public"."sync_event_session_geo_point"();

-- Structural tenant and cross-event assertions used by the following triggers.
CREATE FUNCTION "public"."assert_membership_organization"(
  membership_id UUID,
  expected_organization_id UUID,
  relationship_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "public"."organization_memberships" AS membership
    WHERE membership."id" = membership_id
      AND membership."organization_id" = expected_organization_id
  ) THEN
    RAISE EXCEPTION '% must belong to the cleanup-event organization', relationship_name
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE FUNCTION "public"."validate_cleanup_event_workflow_status"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "public"."cleanup_workflow_statuses" AS workflow_status
    WHERE workflow_status."id" = NEW."current_workflow_status_id"
      AND workflow_status."organization_id" = NEW."organization_id"
      AND workflow_status."mapped_lifecycle_status" = NEW."lifecycle_status"
      AND workflow_status."is_active" = true
  ) THEN
    RAISE EXCEPTION 'cleanup event workflow status must be active, tenant-safe, and match lifecycle status'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "cleanup_events_validate_workflow_status"
BEFORE INSERT OR UPDATE OF
  "organization_id", "current_workflow_status_id", "lifecycle_status"
ON "public"."cleanup_events"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_cleanup_event_workflow_status"();

CREATE FUNCTION "public"."validate_incident_review_tenant"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM "public"."assert_membership_organization"(
    NEW."reviewed_by_membership_id",
    NEW."organization_id",
    'incident reviewer membership'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER "incident_reviews_validate_tenant"
BEFORE INSERT OR UPDATE OF "organization_id", "reviewed_by_membership_id"
ON "public"."incident_reviews"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_incident_review_tenant"();

CREATE FUNCTION "public"."validate_event_coordinator_tenant"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  event_organization_id UUID;
BEGIN
  SELECT event."organization_id"
  INTO event_organization_id
  FROM "public"."cleanup_events" AS event
  WHERE event."id" = NEW."cleanup_event_id";

  PERFORM "public"."assert_membership_organization"(
    NEW."membership_id", event_organization_id, 'coordinator membership'
  );
  PERFORM "public"."assert_membership_organization"(
    NEW."assigned_by_membership_id", event_organization_id, 'coordinator assigner membership'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER "event_coordinators_validate_tenant"
BEFORE INSERT OR UPDATE OF
  "cleanup_event_id", "membership_id", "assigned_by_membership_id"
ON "public"."event_coordinators"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_event_coordinator_tenant"();

CREATE FUNCTION "public"."validate_event_participant_remover"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  event_organization_id UUID;
BEGIN
  IF NEW."removed_by_membership_id" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT event."organization_id"
  INTO event_organization_id
  FROM "public"."cleanup_events" AS event
  WHERE event."id" = NEW."cleanup_event_id";

  PERFORM "public"."assert_membership_organization"(
    NEW."removed_by_membership_id", event_organization_id, 'participant remover membership'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER "event_participants_validate_remover"
BEFORE INSERT OR UPDATE OF "cleanup_event_id", "removed_by_membership_id"
ON "public"."event_participants"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_event_participant_remover"();

CREATE FUNCTION "public"."validate_participant_session_pair"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "public"."event_participants" AS participant
    JOIN "public"."event_sessions" AS session
      ON session."cleanup_event_id" = participant."cleanup_event_id"
    WHERE participant."id" = NEW."participant_id"
      AND session."id" = NEW."session_id"
  ) THEN
    RAISE EXCEPTION 'participant and session must belong to the same cleanup event'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "participant_availability_validate_event"
BEFORE INSERT OR UPDATE OF "participant_id", "session_id"
ON "public"."participant_session_availability"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_participant_session_pair"();

CREATE FUNCTION "public"."validate_session_allocation_context"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  event_organization_id UUID;
BEGIN
  SELECT event."organization_id"
  INTO event_organization_id
  FROM "public"."event_participants" AS participant
  JOIN "public"."event_sessions" AS session
    ON session."cleanup_event_id" = participant."cleanup_event_id"
  JOIN "public"."cleanup_events" AS event
    ON event."id" = participant."cleanup_event_id"
  WHERE participant."id" = NEW."participant_id"
    AND session."id" = NEW."session_id";

  IF event_organization_id IS NULL THEN
    RAISE EXCEPTION 'allocation participant and session must belong to the same cleanup event'
      USING ERRCODE = '23514';
  END IF;

  PERFORM "public"."assert_membership_organization"(
    NEW."allocated_by_membership_id", event_organization_id, 'session allocator membership'
  );

  IF NEW."attendance_marked_by_membership_id" IS NOT NULL THEN
    PERFORM "public"."assert_membership_organization"(
      NEW."attendance_marked_by_membership_id",
      event_organization_id,
      'attendance marker membership'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "session_allocations_validate_context"
BEFORE INSERT OR UPDATE OF
  "participant_id", "session_id", "allocated_by_membership_id",
  "attendance_marked_by_membership_id"
ON "public"."session_allocations"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_session_allocation_context"();

CREATE FUNCTION "public"."validate_event_note_tenant"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  event_organization_id UUID;
BEGIN
  SELECT event."organization_id"
  INTO event_organization_id
  FROM "public"."cleanup_events" AS event
  WHERE event."id" = NEW."cleanup_event_id";

  PERFORM "public"."assert_membership_organization"(
    NEW."author_membership_id", event_organization_id, 'event-note author membership'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER "event_notes_validate_tenant"
BEFORE INSERT OR UPDATE OF "cleanup_event_id", "author_membership_id"
ON "public"."event_notes"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_event_note_tenant"();

CREATE FUNCTION "public"."validate_event_evidence_session"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW."session_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "public"."event_sessions" AS session
    WHERE session."id" = NEW."session_id"
      AND session."cleanup_event_id" = NEW."cleanup_event_id"
  ) THEN
    RAISE EXCEPTION 'evidence session must belong to the same cleanup event'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "event_evidence_validate_session"
BEFORE INSERT OR UPDATE OF "cleanup_event_id", "session_id"
ON "public"."event_evidence"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_event_evidence_session"();

CREATE FUNCTION "public"."validate_event_status_history_context"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  event_organization_id UUID;
BEGIN
  SELECT event."organization_id"
  INTO event_organization_id
  FROM "public"."cleanup_events" AS event
  WHERE event."id" = NEW."cleanup_event_id";

  IF NOT EXISTS (
    SELECT 1
    FROM "public"."cleanup_workflow_statuses" AS workflow_status
    WHERE workflow_status."id" = NEW."to_workflow_status_id"
      AND workflow_status."organization_id" = event_organization_id
  ) THEN
    RAISE EXCEPTION 'event-history destination status must belong to the cleanup-event organization'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."from_workflow_status_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "public"."cleanup_workflow_statuses" AS workflow_status
    WHERE workflow_status."id" = NEW."from_workflow_status_id"
      AND workflow_status."organization_id" = event_organization_id
  ) THEN
    RAISE EXCEPTION 'event-history source status must belong to the cleanup-event organization'
      USING ERRCODE = '23514';
  END IF;

  PERFORM "public"."assert_membership_organization"(
    NEW."changed_by_membership_id", event_organization_id, 'event-status changer membership'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER "event_status_history_validate_context"
BEFORE INSERT OR UPDATE OF
  "cleanup_event_id", "from_workflow_status_id", "to_workflow_status_id",
  "changed_by_membership_id"
ON "public"."event_status_history"
FOR EACH ROW EXECUTE FUNCTION "public"."validate_event_status_history_context"();

-- Every organization receives a required baseline workflow. Organizations can
-- later rename/configure statuses without removing protected lifecycle meaning.
CREATE FUNCTION "public"."create_default_cleanup_workflow"(p_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "public"."cleanup_workflow_statuses"
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
    (gen_random_uuid(), p_organization_id, 'SCHEDULED', 'Scheduled', 'SCHEDULED', 2, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), p_organization_id, 'IN_PROGRESS', 'In Progress', 'IN_PROGRESS', 3, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), p_organization_id, 'COMPLETION_SUBMITTED', 'Completion Submitted', 'COMPLETION_SUBMITTED', 4, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), p_organization_id, 'COMPLETED', 'Completed', 'COMPLETED', 5, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), p_organization_id, 'CANCELLED', 'Cancelled', 'CANCELLED', 6, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

  INSERT INTO "public"."cleanup_workflow_transitions" (
    "id", "organization_id", "from_status_id", "to_status_id"
  )
  SELECT
    gen_random_uuid(),
    p_organization_id,
    from_status."id",
    to_status."id"
  FROM (
    VALUES
      ('DRAFT', 'PUBLISHED'),
      ('PUBLISHED', 'SCHEDULED'),
      ('PUBLISHED', 'IN_PROGRESS'),
      ('SCHEDULED', 'IN_PROGRESS'),
      ('IN_PROGRESS', 'COMPLETION_SUBMITTED'),
      ('COMPLETION_SUBMITTED', 'COMPLETED'),
      ('PUBLISHED', 'CANCELLED'),
      ('SCHEDULED', 'CANCELLED'),
      ('IN_PROGRESS', 'CANCELLED'),
      ('COMPLETION_SUBMITTED', 'IN_PROGRESS')
  ) AS transition("from_code", "to_code")
  JOIN "public"."cleanup_workflow_statuses" AS from_status
    ON from_status."organization_id" = p_organization_id
   AND from_status."code" = transition."from_code"
  JOIN "public"."cleanup_workflow_statuses" AS to_status
    ON to_status."organization_id" = p_organization_id
   AND to_status."code" = transition."to_code";
END;
$$;

CREATE FUNCTION "public"."initialize_organization_cleanup_workflow"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM "public"."create_default_cleanup_workflow"(NEW."id");
  RETURN NEW;
END;
$$;

CREATE TRIGGER "organizations_initialize_cleanup_workflow"
AFTER INSERT ON "public"."organizations"
FOR EACH ROW EXECUTE FUNCTION "public"."initialize_organization_cleanup_workflow"();

DO $$
DECLARE
  organization_record RECORD;
BEGIN
  FOR organization_record IN
    SELECT "id" FROM "public"."organizations"
  LOOP
    PERFORM "public"."create_default_cleanup_workflow"(organization_record."id");
  END LOOP;
END;
$$;

ALTER TABLE "public"."cleanup_workflow_statuses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cleanup_workflow_transitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."incident_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."incident_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."incident_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cleanup_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_coordinators" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."participant_session_availability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."session_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."contribution_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."achievement_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_achievements" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
ON TABLE
  "public"."cleanup_workflow_statuses",
  "public"."cleanup_workflow_transitions",
  "public"."incidents",
  "public"."incident_photos",
  "public"."incident_reviews",
  "public"."incident_status_history",
  "public"."cleanup_events",
  "public"."event_sessions",
  "public"."event_coordinators",
  "public"."event_participants",
  "public"."participant_session_availability",
  "public"."session_allocations",
  "public"."event_notes",
  "public"."event_evidence",
  "public"."event_status_history",
  "public"."contribution_events",
  "public"."achievement_definitions",
  "public"."user_achievements"
FROM anon, authenticated;

COMMIT;
