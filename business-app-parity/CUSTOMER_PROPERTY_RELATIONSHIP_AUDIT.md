# Customer property organization prerequisite

Read-only source audit at parent checkpoint 3b4b8d98cd781f5951c6aa055372a2a567b946ff, 2026-10-14 UTC.

The current customer schema has one mutable address. Estimates reference the customer but have no property identity or immutable service-address snapshot. Estimate listing and dashboard queries join the current customer address. The customer update route can change that address. This is a model limitation, not evidence that existing historical records have already been changed.

Evidence: `shared/db/schema.ts`, `shared/app/api/estimates/route.ts`, `shared/lib/dashboard-data.ts`, and `shared/app/api/customers/route.ts` in this directory. New-estimate POST accepts an address but does not persist an independent historical estimate location for an existing customer.

The smallest proposed extension is a customer-owned properties relationship with address and optional building/unit/area label, plus nullable estimate property identity and a service-address snapshot fixed at estimate creation. Existing estimates, invoices, payments, job reports and photos must retain their existing identities and associations. Invoice/document/message readers need a reviewed source of the historical service location before property selection can be enabled.

Do not backfill historical service locations from the customer's current address without evidence and explicit review. Do not merge customers or properties. Existing single-property customers should require no extra steps; preselect their sole property. Keep property organization inside the customer profile.

No schema, migration, database, property selection UI or production resource was changed in this batch. A candidate schema and compatibility review is the next property task; production migration requires separate approval. This audit does not complete a release gate. Official readiness remains 30% (3/10 gates).
