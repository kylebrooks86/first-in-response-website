import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// This inspector never connects to Cloudflare and opens supplied SQLite files read-only.
export function inspectSchema(db, root) {
  const required={payments:['id','estimate_id','type','amount_cents','status','provider_id','gross_received_cents','bundled_tip_cents','processing_fee_cents','processing_method'],payment_refunds:['id','payment_id','estimate_id','amount_cents','mode','status','provider_refund_id'],payment_checkout_sessions:['id','estimate_id','type','amount_cents','status']};
  const missingColumns=[];
  for(const [table,columns] of Object.entries(required)) {
    const found=new Set(db.prepare(`SELECT name FROM pragma_table_info(?)`).all(table).map(row=>row.name));
    for(const column of columns)if(!found.has(column))missingColumns.push(`${table}.${column}`);
  }
  const requiredIndexes={payments:{idx_payments_stripe_provider_unique:['provider_id',1]},payment_refunds:{idx_payment_refunds_provider:['provider_refund_id',0]},payment_checkout_sessions:{idx_payment_checkout_sessions_one_open_per_estimate:['estimate_id',1]}};
  const invalidIndexes=[];
  for(const [table,indexes] of Object.entries(requiredIndexes)) {
    const actual=db.prepare('SELECT name,"unique",partial FROM pragma_index_list(?)').all(table);
    for(const [name,[column,partial]] of Object.entries(indexes)) {
      const item=actual.find(row=>row.name===name);
      const columns=db.prepare('SELECT name FROM pragma_index_info(?) ORDER BY seqno').all(name).map(row=>row.name);
      const sql=db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name=?").get(name)?.sql||'';
      const predicate=sql.replaceAll('`','').replaceAll('"','').replace(/\s+/g,' ').trim().toLowerCase();
      // SQLite unique indexes permit repeated NULLs. DR's NOT NULL filter has
      // the same provider-ID invariant as LIVE's unfiltered unique index.
      const refundCompatible=table==='payment_refunds'&&item?.partial===1&&/where provider_refund_id is not null;?$/.test(predicate);
      const validPredicate=refundCompatible || (partial===0?item?.partial===0:(table==='payments'?/where provider_id glob 'cs_\*' or provider_id glob 'refund:\*';?$/.test(predicate):/where status\s*=\s*'open';?$/.test(predicate)));
      if(!item||item.unique!==1||(!refundCompatible&&item.partial!==partial)||columns.length!==1||columns[0]!==column||!validPredicate)invalidIndexes.push(name);
    }
  }
  const files=readdirSync(resolve(root,'drizzle')).filter(name=>/^\d{4}_.+\.sql$/.test(name)).sort();
  const journalExists=!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'").get();
  let journal={status:'unavailable',expectedFileCount:files.length};
  if(journalExists){
    const columns=db.prepare("SELECT name FROM pragma_table_info('d1_migrations')").all().map(row=>row.name);
    if(!columns.includes('name'))journal={...journal,status:'unrecognized-format'};
    else {
      const names=db.prepare('SELECT name FROM d1_migrations ORDER BY name').all().map(row=>row.name);
      journal={status:'observed',expectedFileCount:files.length,recordedFileCount:names.length,missing:files.filter(name=>!names.includes(name)),unexpected:names.filter(name=>!files.includes(name)),duplicateNames:[...new Set(names.filter((name,i)=>names.indexOf(name)!==i))]};
    }
  }
  return {schemaCompatible:missingColumns.length===0&&invalidIndexes.length===0,missingColumns,invalidIndexes,journal,productionReady:false,scope:'local read-only SQLite inspection; remote identity and customer ledger not verified'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [filename,root]=process.argv.slice(2);
  if(!filename||!root)throw Error('Usage: node scripts/audit-local-schema.mjs LOCAL_SQLITE_FILE CANDIDATE_ROOT');
  const db=new DatabaseSync(resolve(filename),{readOnly:true});
  try {const report=inspectSchema(db,resolve(root));console.log(JSON.stringify(report,null,2));process.exitCode=report.schemaCompatible?0:1;}finally{db.close();}
}
