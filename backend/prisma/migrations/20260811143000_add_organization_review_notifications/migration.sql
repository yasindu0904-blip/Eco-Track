CREATE TYPE "NotificationType" AS ENUM (
  'INCIDENT_STATUS_CHANGED',
  'NEW_INCIDENT_IN_AREA',
  'EVENT_PUBLISHED',
  'EVENT_JOINED',
  'SESSION_ALLOCATED',
  'EVENT_UPDATED',
  'EVENT_CANCELLED',
  'EVENT_COMPLETED',
  'MEMBERSHIP_UPDATED',
  'ORGANIZATION_REVIEW_UPDATED',
  'ACHIEVEMENT_AWARDED',
  'GENERAL'
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "organization_id" UUID,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "data" JSONB,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_read_at_created_at_idx"
ON "notifications"("user_id", "read_at", "created_at");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
