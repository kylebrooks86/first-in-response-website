/**
 * Public estimate/invoice first-view event, bound to the SAME bearer token
 * and customer on the atomic D1 update, event insertion and final readback.
 * No Stripe calls, emails, SMS or external provider actions.
 *
 * A public portal lookup and a subsequent first-view write are NOT atomic
 * unless each SQL write independently enforces current token/ownership.
 * An interrupted D1 batch acknowledgement may still mean the write committed:
 * never repeat it; read back the exact persisted token-bound record instead.
 */
export async function recordPublicDocumentFirstView(db,{
  kind,id,customerId,token,customerName,serviceSummary,requireNoDepositException=false
}){
  if(kind!=='invoice'&&kind!=='estimate')throw Error('Unknown public document type.');
  if(!id||!customerId||!token)throw Error('A public document requires a saved identity.');
  const invoice=kind==='invoice';
  const table=invoice?'invoices':'estimates';
  const type=invoice?'invoice_viewed':'estimate_viewed';
  const title=String(customerName)+(invoice?' viewed an invoice':' viewed an estimate');
  const body=String(serviceSummary)+(invoice?' invoice':' estimate')+' was opened for the first time.';
  const at=new Date().toISOString();
  const relation=invoice
    ?'AND EXISTS(SELECT 1 FROM estimates e JOIN customers c ON c.id=e.customer_id WHERE e.id=invoices.estimate_id AND e.customer_id=invoices.customer_id)'
    :'AND EXISTS(SELECT 1 FROM customers c WHERE c.id=estimates.customer_id)';
  const audit=(!invoice&&requireNoDepositException)
    ?'AND NOT EXISTS(SELECT 1 FROM deposit_policy_events d WHERE d.estimate_id=estimates.id)':'';
  const status=invoice?'':"AND status NOT IN ('declined','superseded')";
  const update=`UPDATE ${table} SET first_viewed_at=?,status=CASE WHEN status='draft' THEN 'sent' ELSE status END
    WHERE id=? AND customer_id=? AND share_token=? AND first_viewed_at IS NULL ${status} ${relation} ${audit}`;
  const eventJoin=invoice
    ?'JOIN estimates e ON e.id=doc.estimate_id AND e.customer_id=doc.customer_id JOIN customers c ON c.id=e.customer_id'
    :'JOIN customers c ON c.id=doc.customer_id';
  const estimateId=invoice?'doc.estimate_id':'doc.id';
  const event=`INSERT INTO notifications(id,type,title,body,customer_id,estimate_id,created_at)
    SELECT ?,?,?,?,doc.customer_id,${estimateId},? FROM ${table} doc ${eventJoin}
    WHERE doc.id=? AND doc.customer_id=? AND doc.share_token=? AND doc.first_viewed_at=?
    ${invoice?'':"AND doc.status NOT IN ('declined','superseded')"}
    AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.type=? AND n.estimate_id=${estimateId})`;
  let changed=false;
  try{
    const results=await db.batch([
      db.prepare(update).bind(at,id,customerId,token),
      db.prepare(event).bind(crypto.randomUUID(),type,title,body,at,id,customerId,token,at,type)
    ]);
    changed=results?.[0]?.meta?.changes===1;
  }catch{
    // A committed batch can lose its response. A second INSERT could create
    // another notification; only the read-only token-bound receipt is safe.
  }
  try{
    const row=await db.prepare(`SELECT doc.first_viewed_at AS firstViewedAt FROM ${table} doc ${eventJoin}
      WHERE doc.id=? AND doc.customer_id=? AND doc.share_token=?
      ${invoice?'':"AND doc.status NOT IN ('declined','superseded')"} LIMIT 1`)
      .bind(id,customerId,token).first();
    if(typeof row?.firstViewedAt!=='string'||!Number.isFinite(Date.parse(row.firstViewedAt)))
      return {allowed:false,newlyViewed:false};
    return {allowed:true,newlyViewed:changed&&row.firstViewedAt===at};
  }catch{return {allowed:false,newlyViewed:false};}
}
