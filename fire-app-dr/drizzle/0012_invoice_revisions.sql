CREATE TABLE invoice_revisions (
  id text PRIMARY KEY NOT NULL,
  invoice_id text NOT NULL,
  subtotal_cents integer NOT NULL,
  discount_cents integer NOT NULL DEFAULT 0,
  discount_type text NOT NULL DEFAULT 'dollar',
  discount_value integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL,
  due_at text,
  status text NOT NULL,
  items_json text NOT NULL,
  created_at text NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
CREATE INDEX idx_invoice_revisions_invoice_id ON invoice_revisions (invoice_id, created_at);
