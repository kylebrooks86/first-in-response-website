from pathlib import Path

# Guard only evidence-backed, governed, or user-confirmed LIVE parity behavior.
# Scrolling/smoothness is intentionally NOT asserted here; the user froze that
# area as good enough and requested no further smoothness work.
checks = {
    Path('app/layout.tsx'): [
        'statusBarStyle: "default"',
    ],
    Path('app/dashboard.tsx'): [
        # User-confirmed Templates mobile behavior.
        'const editorRef=useRef<HTMLElement|null>(null);',
        'editorRef.current?.scrollIntoView({behavior:"smooth",block:"start"})',
        '<section ref={editorRef} className="template-editor"><header>',

        # Owner navigation / mobile shell behavior that must remain consistent.
        '["dashboard", "Dashboard", House]',
        '["contracts", "Contracts", PenLine]',
        '["customers", "Customers", Users]',
        '["estimates", "Estimates", ClipboardList]',
        '["followups", "Follow-ups", Clock3]',
        '["schedule", "Schedule", CalendarDays]',
        '["invoices", "Invoices", Receipt]',
        '["business", "Business", BriefcaseBusiness]',
        '["payments", "Payments", CreditCard]',
        '["settings", "Templates", Settings]',
        'className="mobile-primary-actions"',
        'className="mobile-back-button"',
        'className={`mobile-home-button ${tab==="dashboard"?"active":""}`}',
        'className="mobile-theme-button"',
        'className="menu-button"',
        'className="bottom-nav"',
        '["dashboard","contracts","customers","estimates","schedule"].includes(id)',
        'window.localStorage.getItem("fire-theme")',
        'window.localStorage.setItem("fire-theme",next)',
        'document.documentElement.dataset.theme=next',

        # Estimate pricing / discount / deposit model.
        'const appreciationCents=appreciation?Math.round(subtotal*0.05):0;',
        'const maxPercent=appreciation?45:50;',
        'const total=subtotal>0?Math.max(15000,subtotal-requestedDiscount):0;',
        'deposit:Math.round(total/2)',
        '5% First Responder & Military',
        '% Percentage',
        '$ Dollar amount',
        'The $150 minimum job charge is applied automatically.',
        '50% deposit to schedule',
        'Add another service',

        # Customer profile structure/tabs and permanent record workflow.
        'Customer profile',
        'Jobs / estimates',
        'Open balance',
        'Continue current job',
        '>Estimates <b>{customerEstimates.length}</b>',
        '>Payments</button>',
        '>Invoices</button>',
        '>Photos <b>{customerPhotos.length}</b>',
        '>Messages <b>{customerMessages.length}</b>',
        '>Notes <b>{customerNotes.length}</b>',

        # LIVE-captured customer profile empty states.
        'No payments recorded',
        'Open an estimate and choose Record payment after receiving money through Wave, Cash App, Venmo, cash, check, card, or bank transfer.',
        'No invoices yet',
        'Open an estimate and tap Create invoice.',

        # LIVE-captured Photos controls.
        '<Label>Photo type</Label>',
        '<SelectItem value="before">Before</SelectItem>',
        '<SelectItem value="after">After</SelectItem>',
        '<SelectItem value="property">Property / damage</SelectItem>',
        'Optional note',
        'Photo library',

        # Estimate pipeline / schedule / invoice owner-state structure.
        '{key:"draft",label:"New quotes"',
        '{key:"sent",label:"Follow up"',
        '{key:"approved",label:"Approved"',
        '{key:"scheduled",label:"Scheduled"',
        '{key:"completed",label:"Completed"',
        '{key:"paid",label:"Paid"',
        '{key:"declined",label:"Lost"',
        '<h2>Needs attention</h2>',
        '<h2>Upcoming jobs</h2>',
        'Number(invoice.pendingRefundCount)>0?"Refund processing":Number(invoice.paymentOverageOpen)>0?"Payment review":statusLabel(invoice.status)',
        'Number(invoice.pendingRefundCount)>0?"Refund pending":Number(invoice.paymentOverageOpen)>0?"Billing exception open"',

        # LIVE-captured scheduling behavior and next-step wording.
        'estimate.status==="approved"?"Next: choose the job date and save it."',
        'estimate.status==="scheduled"?"Next: capture before photos, complete the job report, then create the invoice."',

        # Final invoice remains the canonical completed-job billing amount.
        'const resolvedBillingTotalCents =',
        'estimate.invoiceTotalCents ?? estimate.totalCents',

        # Normal review request is suppressed during refund/overpayment review.
        'Number(estimate.paymentOverageOpen)===0',
        'Number(estimate.pendingRefundCount)===0',
        'initialTemplate="review"',
    ],
    Path('app/estimate/[token]/page.tsx'): [
        # Customer estimate structure and signed-approval flow.
        '<p>ESTIMATE FOR</p>',
        '<small>Estimate total</small>',
        '<small>50% deposit</small>',
        '<AcceptEstimateButton',
        'Approve and sign the estimate first. After approval, the 50% deposit reserves your place on the schedule.',
        'After approval, Kyle will contact you to schedule the job and arrange the 50% deposit.',
        '<CustomerPortalNav/>',

        # Completed jobs collect final invoice balance; billing review blocks payment.
        'const billingTotalCents=Number(row.invoiceTotalCents??row.totalCents);',
        'const canPayBalance=billingStateSafe&&!paymentReviewPending&&row.status==="completed"&&balance>0;',
        'Payment received — account review in progress.',
        'Refund processing.',
    ],
    Path('app/pay/[id]/page.tsx'): [
        # Standalone customer payment page uses deposit before completion and final balance after completion.
        'const paymentType: "deposit"|"balance" = row.status==="completed"?"balance":"deposit";',
        'const dueNow = paymentType==="deposit"?depositRemaining:balance;',
        'After approval, the 50% deposit reserves your place on the schedule. The remaining balance is due upon completion of the work.',
        'Payment received — account review in progress.',
        'This job is paid in full.',
        '<CustomerPortalNav/>',
    ],
    Path('app/invoice/[token]/page.tsx'): [
        # LIVE-captured customer invoice structure/content.
        '<p>INVOICE FOR</p>',
        '<small>Invoice total</small>',
        '<small>Balance due</small>',
        'Cash App:',
        'Venmo:',
        '<CustomerPortalNav/>',

        # Customer-facing billing exception / refund states remain fail-closed.
        'Payment received — account review in progress',
        'Refund processing',
    ],
    Path('app/customer-portal-nav.tsx'): [
        'className="portal-floating-nav"',
        'window.history.back()',
        '<span>Back</span>',
        '<span>Home</span>',
    ],
    Path('app/api/estimates/[id]/route.ts'): [
        # Scheduling requires approval/signature and date, but not a recorded deposit.
        'if(!existing.acceptedAt||!existing.signedAt)',
        'Only an approved estimate can be scheduled.',
        'Choose a job date and time before marking this estimate scheduled.',

        # Accepted/financially-active estimates are frozen; later billing changes belong on invoice.
        'Keep the accepted estimate unchanged and make any final service or price changes on the invoice.',
        'const deposit=Math.round(total/2);',
        'const total=Math.max(15000,subtotal-requestedDiscount);',
    ],
    Path('app/api/payments/route.ts'): [
        # Deposit while approved/scheduled; final invoice amount once completed.
        'estimate.status === "completed"',
        '["approved","scheduled"].includes(estimate.status)',
        'Number(estimate.depositCents)',
        'Number(estimate.totalCents)',

        # No new money while billing reconciliation/refund is unresolved.
        "type='payment_overage' AND resolved_at IS NULL",
        "status='pending' LIMIT 1",

        # Race-safe manual payment insertion and post-write balance re-read.
        'INSERT INTO payments',
        'WHERE ? <= (',
        'The amount due changed while this payment was being recorded.',
        'const refreshed = await env.DB.prepare',
    ],
    Path('app/api/invoices/route.ts'): [
        # Final invoice only after completion; one invoice per estimate; snapshot line items.
        'Mark the job completed before creating the final invoice.',
        'SELECT id,customer_id AS customerId,share_token AS shareToken FROM invoices WHERE estimate_id=? LIMIT 1',
        'INSERT INTO invoice_items',
        'const invoiceStatus = paidCents >= estimateTotalCents ? "paid" : paidCents > 0 ? "partial" : "draft";',
    ],
    Path('app/api/invoices/[id]/route.ts'): [
        # Editable final invoice with revision history and payment/session safety.
        'INSERT INTO invoice_revisions',
        'Invoice total cannot be lower than payments already recorded.',
        'expireOpenCheckoutSessions(existing.estimateId)',
        'A refund is currently processing for this job. Wait for it to finish before editing the final invoice.',
        'existing.status==="sent"||Boolean(existing.firstViewedAt)?"sent":"draft"',
    ],
    Path('app/api/payments/refund/route.ts'): [
        # Refunds are durable, linked to original payment, idempotent, and reconciled into ledger.
        "'Refund',?,'paid'",
        'refundPaymentProvider=`refund:${row.paymentId}:${row.id}`',
        'idempotency-key',
        'fire-refund-${requestId}',
        'externalRefundConfirmed',
        'send the money back first and confirm the external refund before FIRE records it.',
        "status='succeeded'",
    ],
    Path('app/api/message-templates/route.ts'): [
        # Templates remain owner-editable and resettable to governed defaults.
        'if(body.reset)',
        'DELETE FROM message_templates WHERE key=?',
        'ON CONFLICT(key) DO UPDATE SET subject=excluded.subject,body=excluded.body,updated_at=excluded.updated_at',
        'Template message cannot be empty.',
    ],
    Path('app/globals.css'): [
        # Keep the working Templates mobile-flow correction. Do not pin a
        # particular scrolling/performance experiment marker.
        'FIRE_DR_TEMPLATE_MOBILE_PARITY',
    ],
}

missing = []
for path, needles in checks.items():
    if not path.exists():
        missing.append(f'{path}: missing file')
        continue
    text = path.read_text()
    for needle in needles:
        if needle not in text:
            missing.append(f'{path}: missing expected LIVE parity content: {needle}')

if missing:
    print('DR_LIVE_PARITY_OVERLAY_GUARD=FAIL')
    for item in missing:
        print(f'- {item}')
    raise SystemExit(1)

print('DR_LIVE_PARITY_OVERLAY_GUARD=PASS')
print('Protected: owner nav/mobile controls/theme; estimate pricing/discount/minimum/deposit rules; customer record tabs; estimate pipeline/schedule/invoice states; Templates; customer estimate/payment/invoice portals; accepted-estimate freeze; invoice editing/revisions; payment/refund safeguards; review suppression; portal navigation; top-shell status-bar treatment.')
print('Scroll/smoothness behavior is intentionally not modified or pinned by this guard.')
