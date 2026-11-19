-- Nullable additions preserve historical payments; net is derived, never invoice credit.
ALTER TABLE payments ADD COLUMN gross_received_cents INTEGER CHECK (gross_received_cents IS NULL OR gross_received_cents BETWEEN 0 AND 9007199254740991);
ALTER TABLE payments ADD COLUMN bundled_tip_cents INTEGER CHECK (bundled_tip_cents IS NULL OR (bundled_tip_cents >= 0 AND gross_received_cents = amount_cents + bundled_tip_cents));
ALTER TABLE payments ADD COLUMN processing_fee_cents INTEGER CHECK (processing_fee_cents IS NULL OR (processing_fee_cents >= 0 AND gross_received_cents IS NOT NULL AND processing_fee_cents <= gross_received_cents));
ALTER TABLE payments ADD COLUMN processing_method TEXT;
