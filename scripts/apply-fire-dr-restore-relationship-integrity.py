from pathlib import Path

path=Path('app/api/backup/route.ts')
if not path.exists():
    raise SystemExit('app/api/backup/route.ts not found')
text=path.read_text()

old='''    restoreAudit.lifecycleNotificationUniquenessVerified=true;
    restoreAudit.phase="complete";'''
new='''    restoreAudit.lifecycleNotificationUniquenessVerified=true;

    const relationshipChecks=[
      ["invoice",`SELECT inv.id FROM invoices inv LEFT JOIN estimates e ON e.id=inv.estimate_id LEFT JOIN customers c ON c.id=inv.customer_id WHERE e.id IS NULL OR c.id IS NULL LIMIT 1`],
      ["payment",`SELECT p.id FROM payments p LEFT JOIN estimates e ON e.id=p.estimate_id WHERE e.id IS NULL LIMIT 1`],
      ["refund",`SELECT r.id FROM payment_refunds r LEFT JOIN payments p ON p.id=r.payment_id LEFT JOIN estimates e ON e.id=r.estimate_id WHERE p.id IS NULL OR e.id IS NULL OR p.estimate_id<>r.estimate_id LIMIT 1`],
      ["checkout",`SELECT pcs.id FROM payment_checkout_sessions pcs LEFT JOIN estimates e ON e.id=pcs.estimate_id WHERE e.id IS NULL LIMIT 1`],
      ["invoice item",`SELECT ii.id FROM invoice_items ii LEFT JOIN invoices inv ON inv.id=ii.invoice_id WHERE inv.id IS NULL LIMIT 1`],
      ["invoice revision",`SELECT ir.id FROM invoice_revisions ir LEFT JOIN invoices inv ON inv.id=ir.invoice_id WHERE inv.id IS NULL LIMIT 1`],
      ["job report",`SELECT jr.id FROM job_reports jr LEFT JOIN estimates e ON e.id=jr.estimate_id LEFT JOIN customers c ON c.id=jr.customer_id WHERE e.id IS NULL OR c.id IS NULL OR e.customer_id<>jr.customer_id LIMIT 1`],
    ] as const;
    for(const [label,sql] of relationshipChecks){
      const orphan=await env.DB.prepare(sql).first<{id:string}>();
      if(orphan)return postWriteFailure(`Restore verification failed: orphaned ${label} relationship remains for ${orphan.id}.`);
    }
    restoreAudit.relationshipIntegrityVerified=true;
    restoreAudit.phase="complete";'''

if new not in text:
    if old not in text:
        raise SystemExit('DR_RESTORE_RELATIONSHIP_APPLY=FAIL: invariant anchor not found')
    text=text.replace(old,new,1)

old_response='''      lifecycleNotificationUniquenessVerified:true,
      duplicatesPreserved:'''
new_response='''      lifecycleNotificationUniquenessVerified:true,
      relationshipIntegrityVerified:true,
      duplicatesPreserved:'''
if new_response not in text:
    if old_response not in text:
        raise SystemExit('DR_RESTORE_RELATIONSHIP_APPLY=FAIL: response anchor not found')
    text=text.replace(old_response,new_response,1)

path.write_text(text)
print('DR_RESTORE_RELATIONSHIP_APPLY=PASS')
