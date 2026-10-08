import subprocess
import sys
from pathlib import Path

repo_root=Path(__file__).resolve().parent.parent
patch=repo_root/'scripts/fire-dr-tipping.patch'
if not patch.is_file():
    raise SystemExit('DR_TIPPING_APPLY=FAIL: governed tipping patch is missing')

def run(*args):
    return subprocess.run(
        ['git','apply',*args,str(patch)],
        cwd=repo_root,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

check=run('--check')
if check.returncode==0:
    applied=run()
    if applied.returncode!=0:
        raise SystemExit('DR_TIPPING_APPLY=FAIL: '+(applied.stderr.strip() or 'git apply failed'))
    print('DR_TIPPING_APPLY=PASS')
    print('Applied optional final-payment tipping patch.')
else:
    reverse=run('--reverse','--check')
    if reverse.returncode==0:
        print('DR_TIPPING_APPLY=PASS')
        print('Optional final-payment tipping patch already applied; no changes made.')
    else:
        verifier=repo_root/'scripts/verify-fire-dr-tipping.py'
        verified=subprocess.run(
            [sys.executable,str(verifier)],
            cwd=repo_root/'fire-app-dr',
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        if verified.returncode!=0:
            detail=verified.stdout.strip() or check.stderr.strip() or reverse.stderr.strip() or 'patch neither applies nor reverses cleanly'
            raise SystemExit('DR_TIPPING_APPLY=FAIL: combined-source tipping verification failed.\n'+detail)
        print('DR_TIPPING_APPLY=PASS')
        print('Optional final-payment tipping behavior already satisfied in the combined post-overlay source.')
        print('DR_BILLING_INTEGRITY_OVERLAY_APPLIED')
        raise SystemExit(0)


def replace_once(path: Path, old: str, new: str, label: str):
    if not path.exists():
        raise SystemExit(f'DR_BILLING_INTEGRITY_APPLY=FAIL: {path} not found')
    source=path.read_text()
    if new in source:
        return
    if old not in source:
        raise SystemExit(f'DR_BILLING_INTEGRITY_APPLY=FAIL: {label} source fragment not found')
    path.write_text(source.replace(old,new,1))

pay_button=repo_root/'fire-app-dr/app/pay/[id]/pay-button.tsx'
replace_once(
    pay_button,
    '''  const checkout = async () => {
    setLoading(true); setError("");
    try {''',
    '''  const checkout = async () => {
    setLoading(true); setError("");
    const maxTipCents = Math.min(Number(tipBaseCents ?? 0), 50000);
    if (tipCents > maxTipCents) {
      setError("Tip cannot exceed the invoice total or $500.");
      setLoading(false);
      return;
    }
    try {''',
    'pay button unified tip ceiling',
)

estimate_page=repo_root/'fire-app-dr/app/estimate/[token]/page.tsx'
replace_once(
    estimate_page,
    'const session=await response.json() as {id:string;payment_status?:string;amount_total?:number;metadata?:{estimate_id?:string;payment_type?:string;expected_amount_cents?:string}};',
    'const session=await response.json() as {id:string;payment_status?:string;amount_total?:number;metadata?:{estimate_id?:string;payment_type?:string;expected_amount_cents?:string;tip_amount_cents?:string;expected_charge_cents?:string}};',
    'estimate success session metadata',
)
replace_once(
    estimate_page,
    '''  const expectedAmount=Number(session.metadata?.expected_amount_cents??sessionAmount);
  if(!Number.isSafeInteger(sessionAmount)||sessionAmount<=0||!Number.isSafeInteger(expectedAmount)||expectedAmount!==sessionAmount)return false;
  const paymentType=session.metadata.payment_type==="balance"?"balance":"deposit";''',
    '''  const paymentType=session.metadata?.payment_type==="balance"?"balance":"deposit";
  const expectedAmount=Number(session.metadata?.expected_amount_cents??sessionAmount);
  const tipCents=Number(session.metadata?.tip_amount_cents??0);
  const expectedCharge=Number(session.metadata?.expected_charge_cents??(expectedAmount+tipCents));
  if(!Number.isSafeInteger(sessionAmount)||sessionAmount<=0||!Number.isSafeInteger(expectedAmount)||expectedAmount<=0||!Number.isSafeInteger(tipCents)||tipCents<0||!Number.isSafeInteger(expectedCharge)||expectedCharge!==sessionAmount||expectedAmount+tipCents!==sessionAmount)return false;
  if(paymentType!=="balance"&&tipCents>0)return false;
  const maxTipCents=Math.min(Number(estimate.totalCents),50000);
  if(!Number.isSafeInteger(maxTipCents)||maxTipCents<0||tipCents>maxTipCents)return false;''',
    'estimate success tip validation',
)

replace_once(
    estimate_page,
    '''  if(prior){await env.DB.prepare("UPDATE payment_checkout_sessions SET status='paid' WHERE id=?").bind(session.id).run();return true;}
  const existingPaidRow=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid'").bind(estimate.id).first<{amount:number}>();''',
    '''  if(prior){
    if(tipCents>0)await env.DB.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
      SELECT ?,?,'Tip',?,'paid',?,?
      WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)`)
      .bind(crypto.randomUUID(),estimate.id,tipCents,`${session.id}:tip`,new Date().toISOString(),`${session.id}:tip`).run();
    await env.DB.prepare("UPDATE payment_checkout_sessions SET status='paid' WHERE id=?").bind(session.id).run();
    return true;
  }
  const existingPaidRow=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(estimate.id).first<{amount:number}>();''',
    'estimate success prior payment reconciliation',
)
replace_once(
    estimate_page,
    ').bind(crypto.randomUUID(),estimate.id,paymentType,sessionAmount,session.id,now,session.id).run();',
    ').bind(crypto.randomUUID(),estimate.id,paymentType,expectedAmount,session.id,now,session.id).run();',
    'estimate success base payment amount',
)
replace_once(
    estimate_page,
    '''  if(!inserted.meta.changes){await env.DB.prepare("UPDATE payment_checkout_sessions SET status='paid' WHERE id=?").bind(session.id).run();return true;}''',
    '''  if(!inserted.meta.changes){
    const raced=await env.DB.prepare("SELECT estimate_id AS estimateId,type,amount_cents AS amountCents,status FROM payments WHERE provider_id=? LIMIT 1").bind(session.id).first<{estimateId:string;type:string;amountCents:number;status:string}>();
    if(!raced||raced.estimateId!==estimate.id||raced.type!==paymentType||raced.status!=="paid"||Number(raced.amountCents)!==expectedAmount)return false;
    if(tipCents>0){
      await env.DB.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
        SELECT ?,?,'Tip',?,'paid',?,?
        WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)`)
        .bind(crypto.randomUUID(),estimate.id,tipCents,`${session.id}:tip`,now,`${session.id}:tip`).run();
      const tipRow=await env.DB.prepare("SELECT estimate_id AS estimateId,type,amount_cents AS amountCents,status FROM payments WHERE provider_id=? LIMIT 1").bind(`${session.id}:tip`).first<{estimateId:string;type:string;amountCents:number;status:string}>();
      if(!tipRow||tipRow.estimateId!==estimate.id||tipRow.type!=="Tip"||tipRow.status!=="paid"||Number(tipRow.amountCents)!==tipCents)return false;
    }
    await env.DB.prepare("UPDATE payment_checkout_sessions SET status='paid' WHERE id=?").bind(session.id).run();
    return true;
  }''',
    'estimate success insert race reconciliation',
)

replace_once(
    estimate_page,
    '''  const nextPaid=Number(refreshedPaid?.amount??0);''',
    '''  if(tipCents>0){
    await env.DB.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
      SELECT ?,?,'Tip',?,'paid',?,?
      WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)`)
      .bind(crypto.randomUUID(),estimate.id,tipCents,`${session.id}:tip`,now,`${session.id}:tip`).run();
    const tipRow=await env.DB.prepare("SELECT estimate_id AS estimateId,type,amount_cents AS amountCents,status FROM payments WHERE provider_id=? LIMIT 1").bind(`${session.id}:tip`).first<{estimateId:string;type:string;amountCents:number;status:string}>();
    if(!tipRow||tipRow.estimateId!==estimate.id||tipRow.type!=="Tip"||tipRow.status!=="paid"||Number(tipRow.amountCents)!==tipCents)return false;
  }
  const nextPaid=Number(refreshedPaid?.amount??0);''',
    'estimate success fresh tip reconciliation',
)
replace_once(
    estimate_page,
    '${currency(sessionAmount)} ${paymentType} received for ${estimate.service}.',
    '${currency(expectedAmount)} ${paymentType} received for ${estimate.service}.',
    'estimate payment notification excludes tip',
)
replace_once(
    estimate_page,
    '''  if(overpaymentCents>0){''',
    '''  if(tipCents>0)followups.push(
    env.DB.prepare("INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),"tip_received",`Tip received from ${estimate.customer}`,`${currency(tipCents)} tip received with the final card payment.`,estimate.customerId,estimate.id,now)
  );
  if(overpaymentCents>0){''',
    'estimate tip notification',
)
replace_once(
    estimate_page,
    'SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status=\'paid\'',
    'SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status=\'paid\' AND type NOT IN (\'Tip\',\'Tip Refund\')',
    'estimate page paid total excludes tips',
)
replace_once(
    estimate_page,
    '<PayButton shareToken={token} paymentType="balance" label={`Pay ${currency(balance)} remaining balance securely`}/>',
    '<PayButton shareToken={token} paymentType="balance" dueAmountCents={balance} tipBaseCents={billingTotalCents} label={`Pay ${currency(balance)} remaining balance securely`}/>',
    'estimate page passes tip base separately',
)

replace_once(
    estimate_page,
    'const prior=await env.DB.prepare("SELECT id FROM payments WHERE provider_id=? LIMIT 1").bind(session.id).first();',
    'const prior=await env.DB.prepare("SELECT estimate_id AS estimateId,type,amount_cents AS amountCents,status FROM payments WHERE provider_id=? LIMIT 1").bind(session.id).first<{estimateId:string;type:string;amountCents:number;status:string}>();',
    'estimate success prior payment shape',
)
replace_once(
    estimate_page,
    '''  if(prior){
    if(tipCents>0)await env.DB.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
      SELECT ?,?,'Tip',?,'paid',?,?
      WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)`)
      .bind(crypto.randomUUID(),estimate.id,tipCents,`${session.id}:tip`,new Date().toISOString(),`${session.id}:tip`).run();
    await env.DB.prepare("UPDATE payment_checkout_sessions SET status='paid' WHERE id=?").bind(session.id).run();
    return true;
  }''',
    '''  if(prior){
    if(prior.estimateId!==estimate.id||prior.type!==paymentType||prior.status!=="paid"||Number(prior.amountCents)!==expectedAmount)return false;
    if(tipCents>0){
      await env.DB.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
        SELECT ?,?,'Tip',?,'paid',?,?
        WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)`)
        .bind(crypto.randomUUID(),estimate.id,tipCents,`${session.id}:tip`,new Date().toISOString(),`${session.id}:tip`).run();
      const tipRow=await env.DB.prepare("SELECT estimate_id AS estimateId,type,amount_cents AS amountCents,status FROM payments WHERE provider_id=? LIMIT 1").bind(`${session.id}:tip`).first<{estimateId:string;type:string;amountCents:number;status:string}>();
      if(!tipRow||tipRow.estimateId!==estimate.id||tipRow.type!=="Tip"||tipRow.status!=="paid"||Number(tipRow.amountCents)!==tipCents)return false;
    }
    await env.DB.prepare("UPDATE payment_checkout_sessions SET status='paid' WHERE id=?").bind(session.id).run();
    return true;
  }''',
    'estimate success prior payment verification',
)

# Normalize every remaining legacy paid-total query in the customer estimate page.
estimate_text=estimate_page.read_text()
legacy_paid='SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status=\'paid\''
safe_paid='SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status=\'paid\' AND type NOT IN (\'Tip\',\'Tip Refund\')'
legacy_paid_exact=legacy_paid + '").bind'
safe_paid_exact=safe_paid + '").bind'
if legacy_paid_exact in estimate_text:
    estimate_page.write_text(estimate_text.replace(legacy_paid_exact,safe_paid_exact))

notifications=repo_root/'fire-app-dr/app/api/notifications/route.ts'
replace_once(
    notifications,
    "SELECT COALESCE((SELECT SUM(amount_cents) FROM payments WHERE estimate_id=e.id AND status='paid'),0) AS paidCents",
    "SELECT COALESCE((SELECT SUM(amount_cents) FROM payments WHERE estimate_id=e.id AND status='paid' AND type NOT IN ('Tip','Tip Refund')),0) AS paidCents",
    'notification billing paid total excludes tips',
)
replace_once(
    notifications,
    "AND COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid'),0)",
    "AND COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)",
    'notification overpayment resolution excludes tips',
)

invoice=repo_root/'fire-app-dr/app/api/invoices/[id]/route.ts'
replace_once(
    invoice,
    '    await env.DB.batch(statements);\n    return Response.json({invoice:{id,subtotalCents,discountCents:appliedDiscountCents,discountType,discountValue,totalCents,status,dueAt,items:normalized}});',
    '''    await env.DB.batch(statements);

    const postPaidRow=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS paidCents FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(existing.estimateId).first<{paidCents:number}>();
    const postPaidCents=Number(postPaidRow?.paidCents??0);
    if(!Number.isSafeInteger(postPaidCents)||postPaidCents<0)return Response.json({error:"Invoice changes were saved, but the refreshed payment total requires owner review before billing continues."},{status:409});
    const reconciledStatus=postPaidCents>=totalCents?"paid":postPaidCents>0?"partial":(existing.status==="sent"||Boolean(existing.firstViewedAt)?"sent":"draft");
    const postOverpaymentCents=Math.max(0,postPaidCents-totalCents);
    const reconcileStatements=[env.DB.prepare("UPDATE invoices SET status=? WHERE id=?").bind(reconciledStatus,id)];
    if(postOverpaymentCents>0){
      const overpaymentBody="$"+(postOverpaymentCents/100).toFixed(2)+" is currently recorded above the final invoice total after an invoice edit/payment timing change. Review Payments and either refund the excess or intentionally keep it as an overpayment on this job.";
      reconcileStatements.push(
        env.DB.prepare("UPDATE notifications SET title=?,body=? WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL").bind("Review invoice overpayment",overpaymentBody,existing.estimateId),
        env.DB.prepare(`INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at)
          SELECT ?,'payment_overage',?,?,e.customer_id,e.id,? FROM estimates e
          WHERE e.id=? AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL)`)
          .bind(crypto.randomUUID(),"Review invoice overpayment",overpaymentBody,new Date().toISOString(),existing.estimateId)
      );
    }else{
      const resolvedAt=new Date().toISOString();
      reconcileStatements.push(env.DB.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?),resolved_at=?,resolution_note='invoice_edit_reconciled' WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL").bind(resolvedAt,resolvedAt,existing.estimateId));
    }
    await env.DB.batch(reconcileStatements);
    return Response.json({invoice:{id,subtotalCents,discountCents:appliedDiscountCents,discountType,discountValue,totalCents,status:reconciledStatus,dueAt,items:normalized},paidCents:postPaidCents,billingExceptionOpen:postOverpaymentCents>0});''',
    'invoice post-write reconciliation',
)


refund=repo_root/'fire-app-dr/app/api/payments/refund/route.ts'
replace_once(
    refund,
    '''  const [verifiedRequest,verifiedLedger]=await Promise.all([
    env.DB.prepare("SELECT status,amount_cents AS amountCents FROM payment_refunds WHERE id=?").bind(row.id).first<{status:string;amountCents:number}>(),
    env.DB.prepare("SELECT amount_cents AS amountCents FROM payments WHERE provider_id=? LIMIT 1").bind(refundPaymentProvider).first<{amountCents:number}>(),
  ]);
  if(verifiedRequest?.status!=="succeeded"||Number(verifiedRequest.amountCents)!==amount||Number(verifiedLedger?.amountCents)!==-amount)
    return {ok:false,status:409,error:"Refund confirmation did not converge on one verified ledger entry. Refresh payment history before trying anything else."};''',
    '''  const [verifiedRequest,verifiedLedger]=await Promise.all([
    env.DB.prepare("SELECT status,amount_cents AS amountCents FROM payment_refunds WHERE id=?").bind(row.id).first<{status:string;amountCents:number}>(),
    env.DB.prepare("SELECT type,amount_cents AS amountCents,status FROM payments WHERE provider_id=? LIMIT 1").bind(refundPaymentProvider).first<{type:string;amountCents:number;status:string}>(),
  ]);
  const expectedLedgerType=row.paymentType==="Tip"?"Tip Refund":"Refund";
  if(verifiedRequest?.status!=="succeeded"||Number(verifiedRequest.amountCents)!==amount||verifiedLedger?.type!==expectedLedgerType||verifiedLedger?.status!=="paid"||Number(verifiedLedger?.amountCents)!==-amount)
    return {ok:false,status:409,error:"Refund confirmation did not converge on one verified ledger entry. Refresh payment history before trying anything else."};''',
    'refund ledger type verification',
)


backup=repo_root/'fire-app-dr/app/api/backup/route.ts'
replace_once(
    backup,
    '      env.DB.prepare("SELECT id,estimate_id AS estimateId,amount_cents AS amountCents,provider_id AS providerId FROM payments").all<{id:string;estimateId:string;amountCents:number;providerId:string|null}>(),',
    '      env.DB.prepare("SELECT id,estimate_id AS estimateId,type,amount_cents AS amountCents,status,provider_id AS providerId FROM payments").all<{id:string;estimateId:string;type:string;amountCents:number;status:string;providerId:string|null}>(),',
    'backup payment identity query',
)
replace_once(
    backup,
    '''        if(existing&&(String(existing.estimateId)!==String(raw.estimate_id??"")||Number(existing.amountCents)!==Number(raw.amount_cents)||existingProvider!==provider))
          return Response.json({error:`Restore conflict: payment ${id} already exists with different immutable financial values.`},{status:409});''',
    '''        if(existing&&(String(existing.estimateId)!==String(raw.estimate_id??"")||String(existing.type)!==String(raw.type??"")||Number(existing.amountCents)!==Number(raw.amount_cents)||String(existing.status)!==String(raw.status??"")||existingProvider!==provider))
          return Response.json({error:`Restore conflict: payment ${id} already exists with different immutable financial values.`},{status:409});''',
    'backup payment type/status identity',
)
replace_once(
    backup,
    '''      if (Number(ledgerRows[0].amount_cents) !== -amount || String(ledgerRows[0].status ?? "") !== "paid")
        return `Succeeded refund ${id} has a mismatched negative payment ledger row.`;''',
    '''      const expectedLedgerType=String(payment.type??"")==="Tip"?"Tip Refund":"Refund";
      if (Number(ledgerRows[0].amount_cents) !== -amount || String(ledgerRows[0].status ?? "") !== "paid" || String(ledgerRows[0].type ?? "") !== expectedLedgerType)
        return `Succeeded refund ${id} has a mismatched negative payment ledger row.`;''',
    'backup refund ledger type verification',
)


dashboard=repo_root/'fire-app-dr/app/dashboard.tsx'
replace_once(
    dashboard,
    'function EditInvoiceDialog({estimate,onSaved}:{estimate:EstimateRow;onSaved:(totalCents:number)=>void}){',
    'function EditInvoiceDialog({estimate,onSaved}:{estimate:EstimateRow;onSaved:(totalCents:number,paidCents:number,billingExceptionOpen:boolean)=>void}){',
    'invoice edit callback signature',
)

replace_once(
    dashboard,
    'const customerPaidTotal=Math.max(0,safeSignedSumCents(customerPayments.map((payment)=>payment.amountCents)));',
    'const customerPaidTotal=Math.max(0,safeSignedSumCents(customerPayments.filter((payment)=>payment.type!=="Tip"&&payment.type!=="Tip Refund").map((payment)=>payment.amountCents)));',
    'customer profile paid total excludes tips',
)
replace_once(
    dashboard,
    '<strong>{payment.amountCents<0?"Refund":`${paymentTypeLabel(payment.type)} payment`}</strong>',
    '<strong>{payment.type==="Tip"?"Tip":payment.type==="Tip Refund"?"Tip refund":payment.amountCents<0?"Refund":`${paymentTypeLabel(payment.type)} payment`}</strong>',
    'customer payment history labels tips explicitly',
)

# Give the owner the same one-tap tip choices used on the customer checkout.
# This remains inside the existing final-payment-only gate; recording a tip
# still requires the explicit Save payment action.
replace_once(
    dashboard,
    '<div><Label>Amount applied to invoice</Label><Input value={amount} onChange={(event)=>setAmount(event.target.value)} inputMode="decimal" placeholder="0.00"/></div>{normalized.status==="completed"&&<div><Label>Tip received (optional)</Label><Input value={tip} onChange={(event)=>setTip(event.target.value)} inputMode="decimal" placeholder="0.00"/><small className="payment-handle-note">Recorded separately and does not change the invoice balance.</small></div>}',
    '<div><Label>Amount applied to invoice</Label><Input value={amount} onChange={(event)=>setAmount(event.target.value)} inputMode="decimal" placeholder="0.00"/></div>{normalized.status==="completed"&&<div><Label>Tip received (optional)</Label><div className="grid grid-cols-5 gap-1.5" aria-label="Optional tip choices">{[0,5,10,15].map((percent)=><button key={percent} type="button" aria-pressed={Number(tip||0)===Math.round(normalized.totalCents*percent/100)/100} className={`rounded-lg border px-1 py-2 text-sm ${Number(tip||0)===Math.round(normalized.totalCents*percent/100)/100?"border-red-500 bg-red-500/15":"border-slate-600"}`} onClick={()=>setTip((Math.round(normalized.totalCents*percent/100)/100).toFixed(2))}>{percent===0?"No tip":`${percent}%`}</button>)}<button type="button" className="rounded-lg border border-slate-600 px-1 py-2 text-sm" onClick={()=>document.getElementById("fire-manual-tip")?.focus()}>Custom</button></div><Input id="fire-manual-tip" aria-label="Custom tip amount" value={tip} onChange={(event)=>setTip(event.target.value)} inputMode="decimal" placeholder="0.00"/><small className="payment-handle-note">Recorded separately and does not change the invoice balance.</small></div>}',
    'manual final-payment tip presets',
)

# Make the absent final card-payment button understandable to customers.
# Do not weaken the completed-job, Stripe-ready or billing-review gates.
invoice_page=repo_root/'fire-app-dr/app/invoice/[token]/page.tsx'
replace_once(
    invoice_page,
    '{billingStateSafe&&balance>0&&!paymentReviewPending&&row.estimateStatus==="completed"&&paymentsReady&&row.estimateShareToken&&<div className="portal-payment"><PayButton shareToken={row.estimateShareToken} paymentType="balance" dueAmountCents={balance} tipBaseCents={totalCents} label={`Pay ${currency(balance)} remaining balance securely`}/></div>}',
    '{billingStateSafe&&balance>0&&!paymentReviewPending&&row.estimateStatus==="completed"&&paymentsReady&&row.estimateShareToken&&<div className="portal-payment"><PayButton shareToken={row.estimateShareToken} paymentType="balance" dueAmountCents={balance} tipBaseCents={totalCents} label={`Pay ${currency(balance)} remaining balance securely`}/></div>}{billingStateSafe&&balance>0&&!paymentReviewPending&&row.estimateStatus!=="completed"&&<p className="pay-note">Secure final-balance card payment becomes available after the job is marked completed.</p>}{billingStateSafe&&balance>0&&!paymentReviewPending&&row.estimateStatus==="completed"&&!paymentsReady&&<p className="pay-note">Online card payment is currently unavailable. Please contact First In Response Exteriors to arrange payment.</p>}',
    'explain final card-payment availability on customer invoice',
)


# Match the approved customer-facing manual payment cards while preserving
# the dynamic configured handles, checkout gates, and invoice footer.
replace_once(
    invoice_page,
    '{billingStateSafe&&balance>0&&!paymentReviewPending&&row.estimateStatus==="completed"&&<p className="pay-note"><strong>Manual payment options:</strong> Cash App: {handles.cashApp} · Venmo: {handles.venmo}. Please include your name in the payment note.</p>}',
    '''{billingStateSafe&&balance>0&&!paymentReviewPending&&row.estimateStatus==="completed"&&<div className="my-5 space-y-4">
      {paymentsReady&&row.estimateShareToken&&<div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-widest text-slate-400"><span className="h-px flex-1 bg-slate-200"/><span>OR</span><span className="h-px flex-1 bg-slate-200"/></div>}
      <section aria-label="Other payment options" className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm sm:p-5">
        <h2 className="mb-1 text-lg font-bold tracking-tight text-slate-900">Other Payment Options</h2>
        <p className="mb-4 text-sm leading-relaxed text-slate-600">You can also pay manually using Cash App or Venmo. Please include your name in the payment note.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-3xl font-extrabold text-white">$</span>
            <div className="min-w-0"><strong className="block text-base text-slate-900">Cash App</strong><span className="block break-all text-sm text-slate-700">{handles.cashApp}</span></div>
          </div>
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-3">
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-2xl font-extrabold italic text-white">V</span>
            <div className="min-w-0"><strong className="block text-base text-slate-900">Venmo</strong><span className="block break-all text-sm text-slate-700">{handles.venmo}</span></div>
          </div>
        </div>
      </section>
    </div>}''',
    'approved responsive Cash App and Venmo payment cards',
)
replace_once(
    invoice_page,
    '<p className="pay-note">{footer?.body||templateByKey("invoiceFooter").body}</p>',
    '<div className="my-4 flex items-start gap-3 rounded-2xl bg-slate-100 p-4 text-slate-700"><span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xl font-bold text-white">i</span><p className="m-0 text-sm leading-relaxed">{footer?.body||templateByKey("invoiceFooter").body}</p></div>',
    'approved customer invoice thank-you information card',
)

print('DR_BILLING_INTEGRITY_OVERLAY_APPLIED')
