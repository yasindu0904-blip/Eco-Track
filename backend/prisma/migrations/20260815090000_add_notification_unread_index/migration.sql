-- Keep unread-notification inbox and badge queries fast as notification history grows.
CREATE INDEX "notifications_unread_user_created_at_idx"
ON "notifications" ("user_id", "created_at" DESC)
WHERE "read_at" IS NULL;
