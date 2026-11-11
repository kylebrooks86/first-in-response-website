/**
 * FIRE Gate 7: read-only, owner-private, legacy Sites records preservation.
 *
 * READ ONLY: one sqlite_master SELECT, two independent complete SELECT batches
 * with a row-count proof, and a final sqlite_master SELECT. No D1 writes,
 * migration, schema mutation, Stripe call, R2 operation or cloud export.
 *
 * The legacy LIVE schema is known to differ (payment_refunds may be absent).
 * Never invent that table, upgrade it automatically, or label this an
 * independently recoverable full backup: D1 UUID/journals, photo object bytes
 * and a same-instant provider snapshot remain outside this source capability.
 */
export const LEGACY_REVIEW_FORMAT='fire-sites-legacy-records-review';
export const LEGACY_REVIEW_VERSION=1;
const META_SQL="SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%' ORDER BY type,name";
const MAX_TABLES=23; // D1 Free 50 query/request ceiling: 2*23+3=49
const MAX_ROWS=30000;
const MAX_BYTES=8_000_000;
const blocked=()=>{throw new Error('FIRE LEGACY READ-ONLY RECORD REVIEW BLOCKED');};
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const safeName=name=>typeof name==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name);
const quoted=name=>'"'+name+'"';
const rows=result=>{
  if(!result||result.success===false||!Array.isArray(result.results))blocked();
  return result.results;
};
const stableValue=value=>{
  if(Array.isArray(value))return '['+value.map(stableValue).join(',')+']';
  if(isRecord(value))return '{'+Object.keys(value).sort().map(key=>
    JSON.stringify(key)+':'+stableValue(value[key])).join(',')+'}';
  if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))
    return JSON.stringify(value);
  blocked();
};
const snapshotRowSet=data=>{
  if(!Array.isArray(data)||data.length>MAX_ROWS)blocked();
  return data.map(row=>{if(!isRecord(row))blocked();return stableValue(row);}).sort();
};
async function inventory(db){
  const meta=rows(await db.prepare(META_SQL).all());
  if(meta.length>500)blocked();
  const names=new Set();
  for(const row of meta){
    if(!isRecord(row)||!['table','index','trigger','view'].includes(row.type)||
       !safeName(row.name)||!safeName(row.tbl_name)||
       row.sql!==null&&typeof row.sql!=='string')blocked();
    const key=row.type+'\0'+row.name;
    if(names.has(key))blocked();
    names.add(key);
  }
  const tables=meta.filter(row=>row.type==='table').map(row=>row.name);
  if(tables.length<1||tables.length>MAX_TABLES||new Set(tables).size!==tables.length)blocked();
  // This is a LEGACY source path. Permanent numbered history requires the
  // separate reviewed v2 23-table+high-water contract, never this review.
  if(tables.some(name=>['fire_customer_numbers','fire_job_numbers','fire_job_estimate_links'].includes(name)))blocked();
  return {meta,tables};
}
function inspectBatch(raw,tables,hasCount){
  if(!Array.isArray(raw)||raw.length!==tables.length+(hasCount?1:0))blocked();
  const counts=new Map();
  if(hasCount){
    for(const row of rows(raw[0])){
      if(!isRecord(row)||!tables.includes(row.table_name)||
         counts.has(row.table_name)||!Number.isSafeInteger(row.count)||row.count<0)blocked();
      counts.set(row.table_name,row.count);
    }
    if(counts.size!==tables.length)blocked();
  }
  const data=Object.create(null),canonical=Object.create(null);
  let totalRows=0;
  for(let i=0;i<tables.length;i++){
    const table=tables[i],item=rows(raw[i+(hasCount?1:0)]);
    totalRows+=item.length;
    if(totalRows>MAX_ROWS||hasCount&&item.length!==counts.get(table))blocked();
    canonical[table]=snapshotRowSet(item);
    data[table]=item;
  }
  return {counts,data,canonical,totalRows};
}
export async function captureLegacySitesReviewReadOnly(db){
  if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function')blocked();
  const first=await inventory(db);
  const tables=first.tables;
  const countsSQL=tables.map(name=>
    "SELECT '"+name+"' AS table_name,COUNT(*) AS count FROM "+quoted(name)
  ).join(' UNION ALL ');
  // Exactly 2 metadata reads, 1 count query and TWO complete table reads:
  // total 3+2*table_count <=49. Compare every row's canonical contents, not
  // only row counts, to detect changes during the read window.
  const dataSQL=tables.map(name=>'SELECT * FROM '+quoted(name));
  const firstBatch=await db.batch([db.prepare(countsSQL),...dataSQL.map(sql=>db.prepare(sql))]);
  const captured=inspectBatch(firstBatch,tables,true);
  const secondBatch=await db.batch(dataSQL.map(sql=>db.prepare(sql)));
  const repeated=inspectBatch(secondBatch,tables,false);
  for(const table of tables){
    if(captured.canonical[table].length!==repeated.canonical[table].length||
       captured.canonical[table].some((value,i)=>value!==repeated.canonical[table][i]))blocked();
  }
  const last=await inventory(db);
  if(stableValue(first.meta)!==stableValue(last.meta)||stableValue(tables)!==stableValue(last.tables))blocked();
  const rowCounts=Object.fromEntries(tables.map(name=>[name,captured.counts.get(name)]));
  const hasRefundLedger=tables.includes('payment_refunds');
  const payload={
    format:LEGACY_REVIEW_FORMAT,version:LEGACY_REVIEW_VERSION,
    exportedAt:new Date().toISOString(),
    completeBackup:false,recoveryAuthorized:false,restorableWithoutFurtherVerification:false,
    sourceD1UuidVerified:false,sameInstantProviderSnapshotVerified:false,
    schemaCatalogStableAcrossReads:true,repeatReadRowsMatch:true,independentRowCountsMatch:true,
    originalPaymentRefundTablePresent:hasRefundLedger,
    missingRefundLedger:!hasRefundLedger,
    migrationJournalRowsCaptured:tables.includes('d1_migrations')||tables.includes('__drizzle_migrations'),
    migrationJournalIntegrityVerified:false,
    photoMetadataMayBeIncluded:tables.includes('customer_photos'),
    photoObjectBytesIncluded:false,localDevicePhotoBytesIncluded:false,
    sourceTables:tables,
    rowCounts,
    schemaObjects:first.meta,
    tables:captured.data,
    warning:'PRIVATE RECORDS-ONLY REVIEW, NOT A FULL/ATOMIC FIRE BACKUP. This copies actual existing table rows without creating absent refund records. Photo bytes, physical LIVE D1 identity, full ordered migration verification, other storage, owner custody and isolated restore remain UNVERIFIED.'
  };
  payload.sourceTables=tables;
  const json=JSON.stringify(payload);
  if(!json||new TextEncoder().encode(json).byteLength>MAX_BYTES)blocked();
  return Object.freeze(payload);
}
