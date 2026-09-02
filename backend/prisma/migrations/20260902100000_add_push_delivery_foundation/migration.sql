-- NOT-02 foundation only: durable device registrations and push-delivery state.
-- Expo sending, Redis queues, workers, receipt polling, and client registration
-- are deliberately outside this migration.

CREATE TYPE "PushDevicePlatform" AS ENUM ('ANDROID', 'IOS');

CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
  'PENDING',
  'QUEUED',
  'RECEIPT_PENDING',
  'PROVIDER_ACCEPTED',
  'RETRY_PENDING',
  'FAILED'
);

-- A notification and device expose their ownership as candidate keys so each
-- delivery can prove that both records belong to the same EcoTrack user.
ALTER TABLE "public"."notifications"
ADD CONSTRAINT "notifications_user_id_id_key" UNIQUE ("user_id", "id");

CREATE TABLE "public"."user_devices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "installation_id" TEXT NOT NULL,
  "expo_push_token" TEXT,
  "platform" "PushDevicePlatform" NOT NULL,
  "device_name" TEXT,
  "app_version" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "registered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deactivated_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_devices_installation_id_not_blank_check"
    CHECK (btrim("installation_id") <> ''),
  CONSTRAINT "user_devices_push_token_not_blank_check"
    CHECK ("expo_push_token" IS NULL OR btrim("expo_push_token") <> ''),
  CONSTRAINT "user_devices_active_state_check"
    CHECK (
      ("is_active" = true AND "expo_push_token" IS NOT NULL AND "deactivated_at" IS NULL)
      OR
      ("is_active" = false AND "deactivated_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "user_devices_installation_id_key"
ON "public"."user_devices" ("installation_id");

-- PostgreSQL permits multiple NULL values while preventing any non-null Expo
-- token from being attached to more than one installation.
CREATE UNIQUE INDEX "user_devices_expo_push_token_key"
ON "public"."user_devices" ("expo_push_token");

CREATE UNIQUE INDEX "user_devices_user_id_id_key"
ON "public"."user_devices" ("user_id", "id");

CREATE INDEX "user_devices_user_id_is_active_last_seen_at_idx"
ON "public"."user_devices" ("user_id", "is_active", "last_seen_at" DESC);

ALTER TABLE "public"."user_devices"
ADD CONSTRAINT "user_devices_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles" ("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "public"."notification_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "notification_id" UUID NOT NULL,
  "device_id" UUID NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_retry_at" TIMESTAMPTZ(6),
  "expo_ticket_id" TEXT,
  "last_error_code" TEXT,
  "last_error_message" TEXT,
  "sent_at" TIMESTAMPTZ(6),
  "receipt_checked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_deliveries_attempt_count_check"
    CHECK ("attempt_count" >= 0),
  CONSTRAINT "notification_deliveries_retry_time_check"
    CHECK ("status" <> 'RETRY_PENDING' OR "next_retry_at" IS NOT NULL),
  CONSTRAINT "notification_deliveries_receipt_pending_check"
    CHECK (
      "status" <> 'RECEIPT_PENDING'
      OR ("expo_ticket_id" IS NOT NULL AND "sent_at" IS NOT NULL)
    ),
  CONSTRAINT "notification_deliveries_provider_accepted_check"
    CHECK (
      "status" <> 'PROVIDER_ACCEPTED'
      OR ("expo_ticket_id" IS NOT NULL AND "receipt_checked_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "notification_deliveries_notification_id_device_id_key"
ON "public"."notification_deliveries" ("notification_id", "device_id");

CREATE INDEX "notification_deliveries_notification_id_created_at_idx"
ON "public"."notification_deliveries" ("notification_id", "created_at");

CREATE INDEX "notification_deliveries_device_id_created_at_idx"
ON "public"."notification_deliveries" ("device_id", "created_at");

CREATE INDEX "notification_deliveries_retryable_idx"
ON "public"."notification_deliveries" ("status", "next_retry_at", "created_at")
WHERE "status" IN ('PENDING', 'RETRY_PENDING');

ALTER TABLE "public"."notification_deliveries"
ADD CONSTRAINT "notification_deliveries_user_notification_fkey"
FOREIGN KEY ("user_id", "notification_id")
REFERENCES "public"."notifications" ("user_id", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."notification_deliveries"
ADD CONSTRAINT "notification_deliveries_user_device_fkey"
FOREIGN KEY ("user_id", "device_id")
REFERENCES "public"."user_devices" ("user_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- EcoTrack application clients use these tables only through Express. RLS and
-- revoked frontend-role privileges provide defense in depth.
ALTER TABLE "public"."user_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notification_deliveries" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
ON TABLE
  "public"."user_devices",
  "public"."notification_deliveries"
FROM anon, authenticated;
