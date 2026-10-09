# Schedule read failures and retry — October 9, 2026

Resumed clean checkpoint 26a96a1c205b472db779d0197947d18df2f35aae matching remote before edits. FIRE Business App only.

ScheduleView previously ignored unsuccessful HTTP responses and defaulted absent collections to an empty schedule; network/JSON rejection had no catch. It now checks status, requires an array, catches failures and displays an accessible error with Try again. Prior records remain in state. Reload clears selection; stale editor, route link, overdue/upcoming cards and job-specific weather target are hidden while loading/error. General weather remains displayed and its fetching logic is unchanged. Successful retry restores current schedule data and valid empty results still show No upcoming jobs.

900/900 new actual component/hook/load/retry checks (300 per target) pass: HTTP errors, network rejection, invalid JSON, missing/malformed collections and non-Error rejection with initially empty and populated state. Verify retained records, hidden stale controls, recovery, numeric conversions, sorted future scheduled jobs, same-day encoded route destinations/waypoints, overdue completed-job revised balance, exclusion of fully paid/declined past jobs, and selection/change/close/search callbacks. Prior component fails negative control. Initial assertion joined the React text children incorrectly; corrected test text normalization, with all final executions passing.

9/9 selected suite runs: new schedule suite, existing estimate flow (1596/1596) and customer/invoice balances (468/468). TypeScript and builds 3/3 each. Actual materialized shared app hashes 119/119 match; new script separately identical across targets. Snapshot commits/paths/hashes in SCHEDULE_LOAD_ERRORS_EVIDENCE.json.

Overall verified readiness: 30% (3/10 release gates). Deployed/mobile comparisons 0/32; complete remote schema/journals 0/3. Mocked reads/fixed time/synthetic SQLite do not verify hosted/mobile/weather integrations. No scheduling/status-transition rules, financial calculations, weather fetch logic, API/write handlers, auth, schema, adapters or migrations changed. No deployment, remote write, processor mutation, paid service or production change.

Prior review manifests remain historical and do not seal newer source/review inputs. Retain rollback artifacts unchanged.

Next bounded task: review remaining secondary read flows (contracts, follow-ups and dashboard refresh) together to identify the most consequential unresolved failure state; avoid repeating unchanged suites. Where available, prioritize free read-only deployed identity/target-routing evidence before hosted candidate/mobile verification. Never replay sandbox events into the previously observed LIVE endpoint. Release blockers remain identities, complete schema/journals, sandbox isolation, auth/photo adapters, actual mobile light/dark evidence and rollback/approval.
