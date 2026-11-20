# Customer notes — isolated source improvement

Customer profiles now use a multiline note composer, a 5,000-character limit, readable preserved line breaks and mobile-sized controls. Nothing saves automatically. The UI explicitly explains that drafts are temporary while Customers stays open; this is not restart-safe or airplane-mode note storage.

The editor keeps one request identity per customer and exact normalized note text during an uncertain save. Retrying unchanged text reuses that identity. A confirmed save must return the exact ID/customer/content/date before the draft clears or activity refreshes. Other customers' drafts and late-response/authentication protections remain intact.

The owner-only API accepts an optional UUID request ID, inserts once using the existing customer_notes primary key, verifies stored identity/content, returns the original timestamp on repeats and rejects conflicting ID reuse. Legacy callers without IDs remain supported. Invalid object/array/string/null requests, malformed IDs, non-string customer/text fields and excessive notes are refused before writing. No schema migration, hosted write, payment change, automatic customer message or financial recalculation is involved.

Verification covers disposable SQLite duplicates/concurrent requests, a saved note whose readback fails, conflict/auth/input controls, the existing actual CustomersView handler/load tests, 320/390px light/dark browser workflows, and the full built-QA Worker/native D1 workflow with a committed but malformed reply followed by a deliberate UI retry. Screenshot artifacts contain synthetic fixtures only.

The separate promotions integration branch is not merged or modified by this batch. Production release acceptance remains 3/10 gates (30%). Hosted QA migration/publication, private backup retention/provenance and physical iPhone acceptance retain their existing requirements. No repeated original backup export or restoration is requested.
