-- EcoTrack database v2, stage 1:
-- identity, permanent settings, organization onboarding, memberships, and audit.
--
-- This migration deliberately preserves the existing user_profiles row and refuses
-- to replace the old organization tables if they unexpectedly contain business data.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "public"."organizations") THEN
    RAISE EXCEPTION
      'EcoTrack v2 foundation migration expected organizations to be empty';
  END IF;

  IF EXISTS (SELECT 1 FROM "public"."organization_members") THEN
    RAISE EXCEPTION
      'EcoTrack v2 foundation migration expected organization_members to be empty';
  END IF;
END
$$;

-- New enums required by the finalized organization model.
CREATE TYPE "DocumentReviewStatus" AS ENUM (
  'PENDING',
  'VERIFIED',
  'REJECTED'
);

CREATE TYPE "MembershipRole" AS ENUM (
  'ORG_MEMBER',
  'ORG_ADMIN'
);

CREATE TYPE "MembershipRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'DECLINED',
  'WITHDRAWN'
);

CREATE TYPE "MembershipSource" AS ENUM (
  'REQUEST_APPROVED',
  'ADMIN_ADDED',
  'FIRST_ADMIN'
);

-- Rebuild expanded enums so their new values can be used safely within this
-- transactional migration.
CREATE TYPE "AccountStatus_new" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED'
);

ALTER TABLE "public"."user_profiles"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "AccountStatus_new"
    USING ("status"::TEXT::"AccountStatus_new");

DROP TYPE "AccountStatus";
ALTER TYPE "AccountStatus_new" RENAME TO "AccountStatus";

ALTER TABLE "public"."user_profiles"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

CREATE TYPE "OrganizationStatus_new" AS ENUM (
  'PENDING_REVIEW',
  'ACTIVE',
  'DECLINED',
  'SUSPENDED',
  'ARCHIVED'
);

ALTER TABLE "public"."organizations"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OrganizationStatus_new"
    USING ("status"::TEXT::"OrganizationStatus_new");

DROP TYPE "OrganizationStatus";
ALTER TYPE "OrganizationStatus_new" RENAME TO "OrganizationStatus";

ALTER TABLE "public"."organizations"
  ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';

-- Replace the membership status enum only after removing its empty old table.
DROP TABLE "public"."organization_members";
DROP TYPE "OrganizationRole";
DROP TYPE "MembershipStatus";

CREATE TYPE "MembershipStatus" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'LEFT',
  'REMOVED'
);

-- Preserve the existing account status value by renaming the column.
DROP INDEX "public"."user_profiles_platform_role_status_idx";

ALTER TABLE "public"."user_profiles"
  RENAME COLUMN "status" TO "account_status";

ALTER TABLE "public"."user_profiles"
  ADD COLUMN "phone_number" TEXT,
  ADD COLUMN "profile_completed_at" TIMESTAMPTZ(6),
  ADD COLUMN "archived_at" TIMESTAMPTZ(6),
  ALTER COLUMN "full_name" DROP NOT NULL;

CREATE INDEX "user_profiles_platform_role_account_status_idx"
ON "public"."user_profiles"("platform_role", "account_status");

-- Expand the empty organization table into the finalized onboarding record.
ALTER TABLE "public"."organizations"
  RENAME COLUMN "contact_email" TO "official_email";

ALTER TABLE "public"."organizations"
  ADD COLUMN "requested_by_user_id" UUID NOT NULL,
  ADD COLUMN "reviewed_by_user_id" UUID,
  ADD COLUMN "registration_number" TEXT,
  ADD COLUMN "official_phone" TEXT NOT NULL,
  ADD COLUMN "official_address" TEXT NOT NULL,
  ADD COLUMN "reviewed_at" TIMESTAMPTZ(6),
  ADD COLUMN "review_notes" TEXT,
  ADD COLUMN "activated_at" TIMESTAMPTZ(6),
  ADD COLUMN "archived_at" TIMESTAMPTZ(6),
  ALTER COLUMN "official_email" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';

CREATE INDEX "organizations_requested_by_user_id_status_idx"
ON "public"."organizations"("requested_by_user_id", "status");

CREATE TABLE "public"."platform_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "incident_highlight_hours" INTEGER NOT NULL DEFAULT 48,
  "incident_unaddressed_days" INTEGER NOT NULL DEFAULT 7,
  "updated_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_settings_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "platform_settings_highlight_hours_check"
    CHECK ("incident_highlight_hours" > 0),
  CONSTRAINT "platform_settings_unaddressed_days_check"
    CHECK ("incident_unaddressed_days" > 0)
);

INSERT INTO "public"."platform_settings" (
  "id",
  "incident_highlight_hours",
  "incident_unaddressed_days",
  "created_at",
  "updated_at"
)
VALUES (1, 48, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE TABLE "public"."organization_verification_documents" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "reviewed_by_user_id" UUID,
  "document_type" TEXT NOT NULL,
  "storage_path" TEXT NOT NULL,
  "original_file_name" TEXT NOT NULL,
  "review_status" "DocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_at" TIMESTAMPTZ(6),
  "review_notes" TEXT,
  "expires_at" DATE,
  "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_verification_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."organization_memberships" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "source_request_id" UUID,
  "added_or_approved_by_membership_id" UUID,
  "role" "MembershipRole" NOT NULL DEFAULT 'ORG_MEMBER',
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" "MembershipSource" NOT NULL,
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ(6),

  CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."organization_membership_requests" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "requester_user_id" UUID NOT NULL,
  "reviewed_by_membership_id" UUID,
  "message" TEXT,
  "status" "MembershipRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_at" TIMESTAMPTZ(6),
  "review_notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_membership_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."audit_logs" (
  "id" UUID NOT NULL,
  "actor_user_id" UUID,
  "organization_id" UUID,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organization_verification_documents_organization_id_review__idx"
ON "public"."organization_verification_documents"("organization_id", "review_status");

CREATE UNIQUE INDEX "organization_memberships_source_request_id_key"
ON "public"."organization_memberships"("source_request_id");

CREATE INDEX "organization_memberships_user_id_status_idx"
ON "public"."organization_memberships"("user_id", "status");

CREATE INDEX "organization_memberships_organization_id_role_status_idx"
ON "public"."organization_memberships"("organization_id", "role", "status");

CREATE UNIQUE INDEX "organization_memberships_organization_id_user_id_key"
ON "public"."organization_memberships"("organization_id", "user_id");

CREATE UNIQUE INDEX "organization_memberships_organization_id_id_key"
ON "public"."organization_memberships"("organization_id", "id");

CREATE INDEX "organization_membership_requests_organization_id_requester__idx"
ON "public"."organization_membership_requests"(
  "organization_id",
  "requester_user_id",
  "status"
);

CREATE INDEX "organization_membership_requests_requester_user_id_status_idx"
ON "public"."organization_membership_requests"("requester_user_id", "status");

CREATE UNIQUE INDEX "organization_membership_requests_one_pending_idx"
ON "public"."organization_membership_requests"(
  "organization_id",
  "requester_user_id"
)
WHERE "status" = 'PENDING';

CREATE INDEX "audit_logs_organization_id_created_at_idx"
ON "public"."audit_logs"("organization_id", "created_at");

CREATE INDEX "audit_logs_entity_type_entity_id_idx"
ON "public"."audit_logs"("entity_type", "entity_id");

CREATE INDEX "audit_logs_actor_user_id_created_at_idx"
ON "public"."audit_logs"("actor_user_id", "created_at");

ALTER TABLE "public"."platform_settings"
  ADD CONSTRAINT "platform_settings_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."organizations"
  ADD CONSTRAINT "organizations_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user_profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."organizations"
  ADD CONSTRAINT "organizations_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."organization_verification_documents"
  ADD CONSTRAINT "organization_verification_documents_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."organization_verification_documents"
  ADD CONSTRAINT "organization_verification_documents_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."organization_memberships"
  ADD CONSTRAINT "organization_memberships_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."organization_memberships"
  ADD CONSTRAINT "organization_memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."organization_membership_requests"
  ADD CONSTRAINT "organization_membership_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."organization_membership_requests"
  ADD CONSTRAINT "organization_membership_requests_requester_user_id_fkey"
  FOREIGN KEY ("requester_user_id") REFERENCES "public"."user_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."organization_memberships"
  ADD CONSTRAINT "organization_memberships_source_request_id_fkey"
  FOREIGN KEY ("source_request_id")
  REFERENCES "public"."organization_membership_requests"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."organization_memberships"
  ADD CONSTRAINT "organization_memberships_added_or_approved_by_membership_i_fkey"
  FOREIGN KEY ("added_or_approved_by_membership_id")
  REFERENCES "public"."organization_memberships"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."organization_membership_requests"
  ADD CONSTRAINT "organization_membership_requests_reviewed_by_membership_id_fkey"
  FOREIGN KEY ("reviewed_by_membership_id")
  REFERENCES "public"."organization_memberships"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."audit_logs"
  ADD CONSTRAINT "audit_logs_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."user_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."audit_logs"
  ADD CONSTRAINT "audit_logs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backend-only database access: every public application table is protected.
ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_verification_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_membership_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
ON TABLE
  "public"."platform_settings",
  "public"."organization_verification_documents",
  "public"."organization_memberships",
  "public"."organization_membership_requests",
  "public"."audit_logs"
FROM anon, authenticated;

COMMIT;
