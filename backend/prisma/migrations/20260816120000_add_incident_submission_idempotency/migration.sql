BEGIN;

ALTER TABLE "public"."incidents"
ADD COLUMN "submission_id" UUID;

-- Existing foundation/test rows predate the submission contract. Giving each one a
-- random key makes the new constraint safe without changing their identity.
UPDATE "public"."incidents"
SET "submission_id" = gen_random_uuid()
WHERE "submission_id" IS NULL;

ALTER TABLE "public"."incidents"
ALTER COLUMN "submission_id" SET NOT NULL;

CREATE UNIQUE INDEX "incidents_reporter_submission_key"
ON "public"."incidents" ("reporter_user_id", "submission_id");

COMMIT;
