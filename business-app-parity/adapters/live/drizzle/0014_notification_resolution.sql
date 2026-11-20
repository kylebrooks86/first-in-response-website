ALTER TABLE notifications ADD COLUMN resolved_at text;
CREATE INDEX IF NOT EXISTS idx_notifications_resolution ON notifications(type, estimate_id, resolved_at);
