# Estimate read failures, retry and focus recovery — October 9, 2026

Resumed clean checkpoint 107b53eb17e3bafd1d4383f0e8e3837ff70bc08f, matching remote before editing. FIRE Business App only.

Shared EstimatesView no longer ignores HTTP failures or treats missing collections as empty. It checks response status, requires an array, catches network/JSON/read failures, preserves prior rows and displays an accessible alert with Try again in pipeline and list views. Stale cards and editor are hidden on loading/error. Reload clears selection; notification focus waits until records load successfully before opening an estimate. Successful retry restores normal pipeline/list actions.

1596/1596 new actual component/hook/effect/retry/focus checks (532 per target) cover HTTP/server errors, network rejection, invalid JSON, missing/malformed collections, non-Error rejection, initially empty and populated states, both views, selection clearing and stale-focus blocking. Verify all seven pipeline stages, revised invoice amounts, conversions, search/filter, creation and detail update/close callbacks. Prior component fails negative control. Existing customer/invoice balance 468/468 and deposit/invoice-due 390/390 pass; selected suites 9/9, TypeScript 3/3, builds 3/3. Actual materialized app source hashes 119/119 match; new script separately identical across targets. Exact snapshots/paths/hashes in ESTIMATE_LOAD_ERRORS_EVIDENCE.json.

Overall verified readiness: 30% (3/10 release gates). Formal deployed/mobile parity 0/32; complete remote schemas/journals 0/3. Mock timer/hooks/read failures and synthetic SQLite are not hosted/mobile integration evidence. Estimate status transitions, financial logic, APIs/write handlers, database/authentication/adapters/migrations unchanged. No deployment, remote data or Stripe mutation, paid service or production change.

Prior review manifests retained as historical and do not seal newer source/review inputs. Regenerate a fresh manifest during release preparation; do not overwrite rollback artifacts.

Next bounded task: schedule read-error recovery, which still lacks HTTP checks/catch and can present failed data as an empty schedule. Preserve weather and scheduling/completion logic; verify actual callbacks using synthetic fixtures. Recheck remote head before edits/saving and avoid duplicate independent QC. Release blockers remain deployed identities, full schema/journals, sandbox isolation, auth/photo adapters, actual mobile light/dark evidence and rollback/approval.
