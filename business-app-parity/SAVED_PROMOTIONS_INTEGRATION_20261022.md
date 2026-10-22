# FIRE Saved Promotions — isolated integration candidate

Saved rule creation, persistence and mobile Settings editing use the existing owner-only \`message_templates\` namespace. The \`/api/saved-promotions/preview\` endpoint is read-only and evaluates qualifying promotions against a server-derived America/Chicago calendar date. It does **not** trust the client's device clock or a supplied booking date.

An estimate-created-date promotion can qualify on the date of drafting. A confirmed-booking-date promotion (including FIRE's October 15% offer through October 31, 2026) remains PENDING until there is a verified booking, and must never be silently represented as a guaranteed price. The 15% and $25 bundle example is $366 only once all eligibility conditions are met.

The current main estimate editor holds a single additional percent/dollar input and a separate flat bundle field; Work's frozen snapshot/accepted-estimate rules remain the authority for saved totals. Promotion suggestions must feed that existing system without recalculating earlier estimates or modifying signed/paid records. Promotion presets are not authorization for a new customer communication, payment or deployment.

This is an isolated source candidate. Do not merge or deploy without exact CI, synthetic actual editor verification, preserved metadata and release gates.