-- De-duplicate historical lifecycle notifications before adding the uniqueness backstop.
DELETE FROM notifications
WHERE type IN ('estimate_viewed','invoice_viewed','estimate_accepted')
  AND rowid NOT IN (
    SELECT MIN(rowid)
    FROM notifications
    WHERE type IN ('estimate_viewed','invoice_viewed','estimate_accepted')
    GROUP BY type, estimate_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS `idx_notifications_unique_lifecycle`
ON `notifications` (`type`,`estimate_id`)
WHERE `estimate_id` IS NOT NULL
  AND `type` IN ('estimate_viewed','invoice_viewed','estimate_accepted');
