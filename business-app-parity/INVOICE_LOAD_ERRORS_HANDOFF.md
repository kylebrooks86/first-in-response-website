# Invoice read failures, retry and search states — October 9, 2026

Resumed clean checkpoint e718182feb4e94cf4b786873456eb7798fb66c89; remote matched before editing. FIRE Business App only.

Shared InvoicesView previously ignored unsuccessful HTTP responses and converted missing invoice collections to empty, while network/JSON rejection had no catch. It now checks the status, requires an array, catches failures and shows an accessible alert with Try again. Loaded rows are preserved in state after failure; stale invoice/payment controls stay hidden until successful reload. Genuine empty data remains No invoices yet. A search miss against loaded invoices now says No matching invoices and suggests another customer/service/status.

789/789 new actual component/hook/effect/retry/payment-refresh checks (263 per target) pass across empty and populated state: HTTP/server failures, network rejection, invalid JSON, missing/malformed collection, non-Error rejection, retained rows, hidden stale actions, retry recovery, preserved invoice links/deposit/status props, searches and numeric zero handling. Prior component fails negative control. Existing deposit/invoice-due 390/390 and customer/invoice balance 468/468 checks pass; 9/9 selected suite runs total. TypeScript and builds 3/3 each. Actual materialized shared app source 119/119 hashes match, with new test separately identical across targets. Exact snapshots/paths/hashes in INVOICE_LOAD_ERRORS_EVIDENCE.json.

Overall verified readiness: 30% (3/10 release gates). Formal deployed/mobile parity 0/32; complete remote schemas/journals 0/3. These checks do not establish hosted/mobile or processor integration. No financial mathematics, invoice API/write handler, refund, schema, authentication, adapter or migration changes. No deployment, remote write, paid service or production change.

Previous manifests remain historical. PAYMENT_LOAD_CANDIDATE_MANIFEST.json must reject the newer invoice source/review inputs; it does not seal this batch. Exact candidate snapshots plus changed-file hashes are saved here; regenerate a new review manifest when preparing a release bundle rather than rewriting rollback artifacts.

Next bounded task: review estimate-list read failures and recovery, using safe synthetic fixtures and preserving workflow status/actions. Check latest remote head before editing/saving and avoid duplicate independent read-only QC. Production remains blocked on deployed identities, complete schema/journals, sandbox isolation, auth/photo adapters, actual mobile light/dark evidence and rollback/release approval.
