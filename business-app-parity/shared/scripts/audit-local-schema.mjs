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
export function inspectCandidatePreflight(db, root) {
  const schema=inspectSchema(db,root);
  const authColumns=db.prepare("SELECT name,type,\"notnull\",pk FROM pragma_table_info('auth_rate_limits')").all();
  const requiredAuth={key:'TEXT',attempts:'INTEGER',window_started_at:'INTEGER',blocked_until:'INTEGER'};
  const invalidAuthColumns=[];
  for(const [name,type] of Object.entries(requiredAuth)) {
    const column=authColumns.find(item=>item.name===name);
    if(!column||column.type.toUpperCase()!==type||column.notnull!==1||(name==='key'&&column.pk!==1))invalidAuthColumns.push(name);
  }
  // The login UPSERT targets key alone, so a composite primary key is incompatible.
  if(authColumns.filter(column=>column.pk>0).length!==1&&!invalidAuthColumns.includes('key'))invalidAuthColumns.push('key');
  const names=['providerCollisions','invalidRefundLinks','invalidSucceededRefundLedgers'];
  const statements=readFileSync(resolve(root,'scripts/stripe-ledger-preflight.sql'),'utf8')
    .replace(/--[^\n]*/g,'').split(';').map(value=>value.trim()).filter(Boolean);
  if(statements.length!==names.length||statements.some(sql=>!/^SELECT\s/i.test(sql)))throw Error('Unexpected read-only ledger preflight query set.');
  const ledgerChecks=statements.map((sql,index)=>{
    try{return {name:names[index],status:'observed',anomalyCount:Number(db.prepare(`SELECT COUNT(*) AS count FROM (${sql})`).get().count)};}
    catch{return {name:names[index],status:'unavailable',anomalyCount:null};}
  });
  const journalCompatible=schema.journal.status==='observed'&&['missing','unexpected','duplicateNames'].every(key=>schema.journal[key].length===0);
  const authSchemaCompatible=invalidAuthColumns.length===0;
  const ledgerClear=ledgerChecks.every(check=>check.status==='observed'&&check.anomalyCount===0);
  return {...schema,authSchemaCompatible,invalidAuthColumns,ledgerChecks,journalCompatible,
    candidatePreflightClear:schema.schemaCompatible&&authSchemaCompatible&&ledgerClear&&journalCompatible,
    remoteVerified:false,productionReady:false,
    scope:'local read-only candidate schema/auth/ledger/journal preflight; no deployment, resource isolation or remote verification'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [filename,root]=process.argv.slice(2);
  if(!filename||!root)throw Error('Usage: node scripts/audit-local-schema.mjs LOCAL_SQLITE_FILE CANDIDATE_ROOT');
  const db=new DatabaseSync(resolve(filename),{readOnly:true});
  try {const report=inspectCandidatePreflight(db,resolve(root));console.log(JSON.stringify(report,null,2));process.exitCode=report.candidatePreflightClear?0:1;}finally{db.close();}
}
