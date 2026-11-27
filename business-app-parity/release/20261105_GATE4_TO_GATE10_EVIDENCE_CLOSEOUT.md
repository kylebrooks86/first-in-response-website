# FIRE Business App — Gate 4–10 evidence closeout packet
Date: 2026-11-05 | Status: **REVIEW ONLY; LIVE NO-GO** | Public data: sanitized

## Scope and interpretation

This packet inventories **genuine provider/device evidence still needed** to close the formal numbered production gates. It is not permission for a migration, publish, Stripe write, database export, backup restore, or protected-site change. Preserve previously accepted Gates 1–3. Do not count offline CI as hosted acceptance. A failed read-only check is **unavailable**, not proof of absence, unless the specific verified provider viewer actually lists the exact object scope.

**Consolidated draft review:** PR #172, initially pinned source `c9ec6c6f3cd2fbcf3bb9759dd37f45065ad57f36`, based on full 8/8-tested main-safe app baseline `b8ce230c369819f778e4579bc487fe6cd574767a`; it incorporates iPhone responsiveness/historical-estimate draft fixes plus signed failed-refund reconciliation. If further source-only evidence edits alter PR #172's head, review the **new exact final SHA** rather than treating this initial pin as current. No deployment.

**Recorded CI for initial composite SHA:** Main-target website/calculator *source preservation*, Gate 4 offline preflight, QA update publisher safety, staging migration/source parity with Gate 8 and Gate 9 tests, numbered v2 records recovery and complete-photo pairing all passed (six app-specific workflows). Separate existing public website content verifier remained red and must not be waived. No one has executed the complete eight-job pinned regression harness on this composite SHA. CI is not Sites provider proof, a customer-photo archive, or native iPhone evidence.

## Owner-observed hosted findings — strong but bounded

- LIVE Sites project `appgprj_6aaf416f82c88191a292fa2e13a9ea61`: authenticated owner Database view **Connected**, visible user table list includes `payments` and `payment_checkout_sessions` but **does not list `payment_refunds`**. Three saved owner screenshots establish this visible state; they do not establish a physical D1 UUID or complete SQLite journal.
- Isolated refund-staging Sites project `appgprj_6ac7e8e358dc81918d0a47c4034c4a41`: authenticated owner Database view **Connected**, `payment_refunds` present and selectable; viewer says **“This table is empty.”** Its code/storage remains distinct at the project UI level, but physical D1 isolation is not proved.
- Both candidate source variants of migration 0019 have identical Git blob `011fc41abf8dfbbdd6f36ac9a1213844238915ab`, 0020 have identical `da0f5382947984da5036273e87bbbbe9bdcb43a6`, and source journals match `63453bed106723da0e74910459ac5f5f0f865dcd`. **Source journal ≠ actual bound LIVE `d1_migrations`.**
- Owner-approved isolated QA Worker `fire-fullapp-qa-20261016` last verified at active immutable version `69373734-52b3-4747-8e1c-323a59e9710f`, 100% traffic, bound QA D1 UUID `8ccfb1f8-1657-4074-b1b2-47de78f95003`, no R2; still requires **fresh authenticated readback** before any future distinct QA publication. Historical code version `8165ead3-43f1-48fd-b077-a1881ed0b978` is not the current deployment. QA code rollback does not restore D1/device photos.
- Stripe **TEST account** read-only provider evidence (not live mode): five historical Checkout Sessions (3 paid, 2 expired); one prior successful $100 test refund. Dedicated TEST webhook endpoint created 2026-11-03 subscribes to five events (`checkout.session.completed`, `checkout.session.async_payment_failed`, `checkout.session.async_payment_succeeded`, `refund.created`, `refund.updated`). The new draft source also handles `refund.failed`, but **that sixth event is not in the dedicated endpoint's current subscription**. Historical October test events predate that dedicated endpoint; they are **not** signed-delivery/ledger proof. DO NOT change the endpoint or activate a Worker without separate exact authorization and remote-binding parity.

## Gate-by-gate closure contracts

| Gate | Current accepted evidence | Outstanding acceptance evidence | Source of truth / next authorized action |
|---|---|---|---|
| **4 — LIVE hosting/physical isolation** | Two distinct Sites UI projects and two connected DB viewers | Authenticated LIVE and staging currently serving immutable code/source artifact; actual bound physical resource IDs or equivalent strong provider attestation; isolation verified | OpenAI Sites specialist. If owner UI cannot expose this, record a provider-verified mapping and obtain explicit acceptance of an alternative standard. Do not infer IDs from Worker QA, source or Site display names |
| **5 — LIVE financial schema** | LIVE table list lacks `payment_refunds`; staging table present, empty; exact 0019/0020 candidate SQL identified | Exact LIVE binding **after Gate 4**, actual `sqlite_master` DDL/indexes and ordered applied `d1_migrations`; aggregate duplicate provider-reference count; explicit backup/restore proof; compatible safe migration decision | Supported metadata-only query on the **authenticated exact** LIVE database; refer to existing `LIVE_REFUND_GAP_READ_ONLY.sql`. No destructive command, table copy, blind 0019 replay, or migration before backup and owner authorization |
| **6 — hosted authentication/privacy** | Source guards and offline tests | Hosted owner positive + nonowner negative + unrelated-customer denial on exact serving candidate; private estimate/invoice link scope; no token leakage or privilege bypass; result timestamps and expected statuses | Separate authorized sandbox identities/private links and hosted read-only black-box actions; sanitized result statuses only, never secrets or customer rows |
| **7 — private recovery** | Source-only numbered records/photo pairing and negative controls pass | Independent encrypted or access-controlled private DB backup and every applicable original photo store; hashes, manifest, offline restore, ownership/custody, and failure recovery for actual bound resources | Target-confirmed backup metadata; restore in an isolated disposable environment, not LIVE. Do not assume code rollback equals DB/photo recovery |
| **8 — iPhone owner acceptance** | Published old synthetic QA app usable; draft #167/#168 UX fixes and #170 source-contract tests, now in unified candidate; 95 source checks pass | Owner-approved exact QA-only build (after fresh Worker/D1 review); physical iPhone customer preview open/back, eligible vs declined estimate behavior, deposit wording, scroll/close and repeat-tap stutter, customer/estimate/payment persistence and optional controls. Security identity remains Gate 6 | Existing QA Worker ONLY, separate exact consent before publish; owner iPhone Safari/PWA functional acceptance. Native performance not inferred from desktop Chromium |
| **9 — Stripe TEST reconciliation** | Provider confirms historical TEST checkout/refund; new signed failed-refund source code passes offline native SQLite tests | Strict inactive TEST Worker source/assets/remote D1 binding and auth parity; expressly approved activation; aligned **necessary** webhook event subscriptions; one **new genuine signed TEST** event delivered to exact isolated Worker and exact-cents D1 ledger verified, including retry/duplicate/failure behavior | Named isolated Stripe TEST Worker, not LIVE, staging, QA or Doomsday. Never weaken `--strict` or overwrite remote binding/asset differences merely to upload |
| **10 — release seal** | Main-safe consolidated candidate and passing app CI | Gates 4–9 independently accepted; exact final source commit, reproducible serving artifact, full regression and independent website verifier disposition, actual LIVE binding, backups and recovery drill, explicit owner LIVE go/no-go authorization | Formal final release review; no implicit approval from a passing CI job or restored code version |

## What can advance immediately, without waiting for Sites Support

1. **Gate 8:** use the combined draft source and passing offline tests to prepare a *read-only*, fresh owner-Acer QA update review with exact source SHA. Approval to **publish** remains separate; avoid repeating old customer-save/$25-quote/Google Voice passes. Device acceptance stays open until actual iPhone testing of published fixes.
2. **Gate 9:** source implementation and automated tests can be reviewed; prepare a TEST-only strict Worker asset/binding reconciliation and a signed event/ledger test plan, but **no endpoint subscription change and no upload/activation** without explicit scope-specific approval.
3. **Gate 6:** prepare expected positive/negative hosted test matrix using synthetic identities only; source guards do not close this gate.
4. **Gates 4/5/7:** prepare provider questions and a backup/restore design. Do not attempt to substitute direct Cloudflare QA Worker metadata for Sites-managed resources.

## Provider specialist — precise narrow request

For each exact Sites project ID above, please provide a read-only authenticated record of:
1. Currently serving immutable deployment/version identifier and associated exact source/build artifact (or a trustworthy provenance attestation).
2. Actual provider database physical identifier/UUID **or equivalent provider-backed unique storage mapping** with verified isolation between projects.
3. Whether the owner has a supported metadata-only view of `d1_migrations`, `sqlite_master`, column/index definitions, database version and recovery/bookmark availability.
4. Whether an independently recoverable private backup/export of DB plus uploaded files is owner-accessible, and what a code-only Sites restore would not recover.
5. Any provider limitation preventing these details from being exposed. **Do not mutate, publish, restore, migrate, redeploy or reveal customer/payment records.**

Do not mark Gate 4 or 5 accepted based solely on a second screenshot of the same table list. Do not run `wrangler d1 execute` without a separately authenticated exact Sites physical database target.

## Final safety ledger

- No resource/action in this packet permits a Stripe charge/refund, customer communication, live code publish, remote SQL write, schema migration, secret adjustment, backup restore or cloud Worker deployment.
- Keep PR #172 DRAFT, release **3 of 10 formal gates accepted; 4–10 open** until separately verified.
- Sensitive evidence (private exports, payment/customer rows, cookies, API keys, ZIP archives, webhook secrets) must remain outside public GitHub discussions and PR artifacts.
