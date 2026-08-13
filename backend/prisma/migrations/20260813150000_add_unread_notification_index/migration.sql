-- Optimize the notification bell and unread-notification list without
-- indexing notification rows that have already been read.
CREATE INDEX "notifications_unread_user_created_at_idx"
ON "notifications" ("user_id", "created_at" DESC)
WHERE "read_at" IS NULL;
