ALTER TABLE `invoices` ADD `subtotal_cents` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoices` ADD `discount_cents` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoices` ADD `discount_type` text DEFAULT 'dollar' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoices` ADD `discount_value` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `invoice_items` (
  `id` text PRIMARY KEY NOT NULL,
  `invoice_id` text NOT NULL,
  `name` text NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `quantity` integer DEFAULT 1 NOT NULL,
  `unit` text DEFAULT 'job' NOT NULL,
  `total_cents` integer NOT NULL,
  FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_invoice_items_invoice_id` ON `invoice_items` (`invoice_id`);
--> statement-breakpoint
INSERT INTO `invoice_items` (`id`,`invoice_id`,`name`,`description`,`quantity`,`unit`,`total_cents`)
SELECT lower(hex(randomblob(16))), inv.id, ei.name, ei.description, ei.quantity, ei.unit, ei.total_cents
FROM `invoices` inv JOIN `estimate_items` ei ON ei.estimate_id=inv.estimate_id;
--> statement-breakpoint
UPDATE `invoices`
SET `subtotal_cents`=COALESCE((SELECT SUM(ii.total_cents) FROM invoice_items ii WHERE ii.invoice_id=invoices.id), total_cents),
    `discount_cents`=MAX(0, COALESCE((SELECT SUM(ii.total_cents) FROM invoice_items ii WHERE ii.invoice_id=invoices.id), total_cents)-total_cents),
    `discount_type`='dollar',
    `discount_value`=MAX(0, COALESCE((SELECT SUM(ii.total_cents) FROM invoice_items ii WHERE ii.invoice_id=invoices.id), total_cents)-total_cents);
