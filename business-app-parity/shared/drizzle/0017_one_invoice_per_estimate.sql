-- Enforce the application invariant: one final invoice per estimate.
-- If legacy duplicates exist, CREATE UNIQUE INDEX fails safely instead of deleting financial records.
CREATE UNIQUE INDEX `idx_invoices_one_per_estimate`
ON `invoices` (`estimate_id`);
