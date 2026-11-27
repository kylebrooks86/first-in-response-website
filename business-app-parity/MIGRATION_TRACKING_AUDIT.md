# Migration and deployment safety audit

Published reference has 22 SQL files (0000–0021), while its journal omits 0010–0020. The governed preparation script explicitly discovers/sorts all SQL files, enforces contiguous numbers, stages their exact bytes, and invokes Wrangler D1 migration application. Thus the incomplete Drizzle generator journal is not evidence that the governed deployed D1 omitted those migrations.

Do not invent timestamps or rewrite old journal entries, renumber applied migrations, or rerun destructive dedup SQL. Inspect each target's actual `d1_migrations` journal and SQLite schema/indexes before planning upgrade. Native Sites overview exposes user tables/columns but not this journal or indexes. Independent Cloudflare credentials are unavailable here; remote verification is pending.

LIVE/staging history differs from DR. The new additive unique index is migration 0020 in LIVE/staging and 0022 in DR. Candidate totals are 21 and 23 SQL files respectively. It contains no UPDATE/DELETE. Run `scripts/stripe-ledger-preflight.sql` read-only on the exact target. Any collision or refund linkage anomaly blocks release and requires explicit record review; index creation itself aborts on collisions without deleting rows.

The governed published-v138 build still expects 22 files; it is not silently changed to accept this new candidate. Candidate promotion requires a new governed manifest/artifact seal that pins the new migration sets and hashes. Never weaken its 22-file check merely to deploy an unreviewed build. Older generic R2/21-migration instructions are obsolete for published v138; current no-R2 governed path is authoritative. Original rollback artifacts remain immutable.

DR no-R2 is a real capability gap. No free object-storage binding has been verified. Do not provision/activate R2 or attach LIVE storage without the owner's approved free-resource plan. Photos must fail clearly when storage is absent.

Existing short PIN auth remains unchanged. A possible future improvement is a stronger owner-chosen credential whose verifier and signing secret live in Worker secrets, with rate limiting and recovery tested in a separate environment. No credential/authentication transition has been implemented or approved; no lockout risk is introduced by this source checkpoint.
