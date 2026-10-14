# Prepared messages and owner-confirmed sending

Parent checkpoint: 72cf96b179b36d24ced9764f2668b619cb54f56a. Branch: work/fire-business-app-parity-2026-10-08. Date: 2026-10-14 UTC (October 13 evening in America/Chicago).

Previously, Text and Email logged an interaction and advanced a draft estimate before opening the external composer. The candidate now records text_prepared or email_prepared, opens the same external composer, and requires the owner to choose “I sent the prepared message” after sending. Opening, canceling, copying, or failed confirmation does not mark the estimate Sent. The pending confirmation displays the recorded message and permits “Not sent — keep editing.” Errors remain visible without automatic retry.

Confirmation is authenticated and tied to the prepared message's customer. It appends a text_confirmed or email_confirmed record with a deterministic identity, preserving the original preparation. A transactional D1 batch records confirmation and changes only the matching Draft estimate, only for the estimate template and only without an existing invoice. Repeated explicit confirmation does not duplicate history. Other status transitions remain unchanged. The UI reads the returned server status rather than performing a second estimate write. Sent means owner-confirmed, never delivered/read.

Message history labels Prepared, owner-confirmed Sent, Copied, and legacy interactions explicitly. Legacy entries are unchanged and are not relabeled as proven sending. Existing legacy review/rebooking timing remains intact; new prepared records are excluded and confirmed records count at confirmation time. General follow-up age calculations are not changed in this batch.

Synthetic populated-dashboard testing uncovered a server/client date mismatch (UTC day 14 versus Chicago day 13) in the Recent estimates tile. The tile's day and month now both use en-US and America/Chicago. No CSS, animation, scrolling, or speculative layout changes were made.

Final verification is recorded in MESSAGE_SEND_CONFIRMATION_EVIDENCE.json: actual framework browser flows, disposable local D1, synthetic authenticated sessions, financial regressions, TypeScript checks, full builds, and shared-source parity across all three candidates. Browser scenarios cover preparation without status advancement, canceled sending, failed confirmation, deliberate confirmation, repeated confirmation, incorrect customer/absent explicit approval, email preparation/confirmation, and populated-dashboard date hydration. Initial cleanup/navigation failures led to the real date fix before final clean runs.

No native iPhone Messages/Mail transmission or delivery was tested. Confirmation state is maintained within the mounted composer; preparation history persists, but a new history-based confirmation/resumption flow after reload is not implemented. Original cached clients and coordinated publication need separate compatibility review before deployment; new POST input channels intentionally distinguish preparation and direct text/email submissions are rejected. No deployment or migration occurred.

Next priority: base follow-up timing on confirmed estimate-sent/contact events without treating preparation as contact. Multiple properties still require the historical service-address prerequisite described in CUSTOMER_PROPERTY_RELATIONSHIP_AUDIT.md. Remaining release gates are unchanged; synthetic tests and source parity do not establish deployed parity or real-device readiness.

LIVE, Doomsday, refund staging, original Home Screen apps, FIRE Calculator, production databases, Stripe, device vaults and original backups were not changed. No paid services, device recovery, resets, app deletion or storage clearing. Official release readiness remains 30% (3/10 gates).
