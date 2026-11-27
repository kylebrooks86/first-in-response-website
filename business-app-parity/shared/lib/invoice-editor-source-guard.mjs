/**
 * Immutable, no-schema invoice edit source comparison. The owner editor
 * submits the exact persisted invoice header and saved service-line identities
 * it loaded; both a read-only preflight and the FIRST transactional D1 statement
 * must match before an invoice revision can replace any saved values.
 *
 * Prevents updates that did not create an invoice_revisions row (e.g. payment
 * status, due-date or line repair) from being overwritten by an older tab.
 * SQL values are bound parameters; no user data is interpolated into SQL.
 */
const cents=x=>Number.isSafeInteger(x)&&x>=0;
const valText=(x,max)=>typeof x==='string'&&x.length<=max;
const nullable=(x,max)=>x===null||valText(x,max);
const validStatus=new Set(['draft','sent','partial','paid']);
const validType=new Set(['dollar','percent']);

export function normalizeOriginalInvoiceSnapshot(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const {estimateId,customerId,subtotalCents,discountCents,discountType,
  discountValue,totalCents,dueAt,storedStatus,items}=raw;
 if(!valText(estimateId,160)||!estimateId||
    !valText(customerId,160)||!customerId||
    !cents(subtotalCents)||!cents(discountCents)||
    !validType.has(discountType)||!cents(discountValue)||
    !cents(totalCents)||!nullable(dueAt,100)||
    !validStatus.has(storedStatus)||
    !Array.isArray(items)||!items.length||items.length>200)
  return null;
 const ids=new Set();
 const saved=[];
 for(const item of items){
  if(!item||typeof item!=='object'||Array.isArray(item)||
     !valText(item.id,160)||!item.id||ids.has(item.id)||
     !valText(item.name,5000)||!item.name.trim()||
     !nullable(item.description,5000)||
     typeof item.quantity!=='number'||!Number.isFinite(item.quantity)||item.quantity<=0||
     !nullable(item.unit,120)||!cents(item.totalCents))return null;
  ids.add(item.id);
  saved.push({id:item.id,name:item.name,description:item.description,
   quantity:item.quantity,unit:item.unit,totalCents:item.totalCents});
 }
 return {estimateId,customerId,subtotalCents,discountCents,discountType,
  discountValue,totalCents,dueAt,storedStatus,items:saved};
}

export function matchesOriginalInvoiceSnapshot(header,lines,snapshot){
 if(!header||!Array.isArray(lines)||!snapshot||lines.length!==snapshot.items.length)return false;
 const fields=['subtotalCents','discountCents','discountType','discountValue','totalCents'];
 if(header.estimateId!==snapshot.estimateId||
    header.customerId!==snapshot.customerId||
    fields.some(k=>header[k]!==snapshot[k])||
    (header.dueAt??null)!==snapshot.dueAt||
    header.status!==snapshot.storedStatus)return false;
 const byId=new Map(lines.map(line=>[line.id,line]));
 if(byId.size!==snapshot.items.length)return false;
 return snapshot.items.every(original=>{
  const line=byId.get(original.id);
  return line&&line.name===original.name&&
   (line.description??null)===original.description&&
   line.quantity===original.quantity&&
   (line.unit??null)===original.unit&&
   line.totalCents===original.totalCents;
 });
}

export function invoiceOriginalSQLGuard(snapshot){
 if(!snapshot||!Array.isArray(snapshot.items)||!snapshot.items.length)
  throw Error('FIRE invoice source guard requires a verified original invoice');
 const parts=[
  'guard.estimate_id IS ?', 'guard.customer_id IS ?',
  'guard.subtotal_cents IS ?', 'guard.discount_cents IS ?',
  'guard.discount_type IS ?', 'guard.discount_value IS ?',
  'guard.total_cents IS ?', 'guard.due_at IS ?', 'guard.status IS ?',
  '(SELECT COUNT(*) FROM invoice_items saved WHERE saved.invoice_id=guard.id)=?'
 ];
 const args=[snapshot.estimateId,snapshot.customerId,snapshot.subtotalCents,
  snapshot.discountCents,snapshot.discountType,snapshot.discountValue,
  snapshot.totalCents,snapshot.dueAt,snapshot.storedStatus,snapshot.items.length];
 for(const item of snapshot.items){
  parts.push('EXISTS(SELECT 1 FROM invoice_items saved WHERE saved.invoice_id=guard.id AND saved.id IS ? AND saved.name IS ? AND saved.description IS ? AND saved.quantity IS ? AND saved.unit IS ? AND saved.total_cents IS ?)');
  args.push(item.id,item.name,item.description,item.quantity,item.unit,item.totalCents);
 }
 return {sql:parts.join(' AND '),args};
}
