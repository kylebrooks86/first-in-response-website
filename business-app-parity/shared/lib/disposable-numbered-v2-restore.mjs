/** FIRE numbered recovery: DISPOSABLE NODE SQLITE ONLY. Never wire to an
 * authenticated Worker, Cloudflare D1, production backup, or a real customer
 * database. This deliberately refuses every on-disk DB, attached database,
 * active table, unknown feature table, missing column and unverified archive.
 *
 * No filesystem, network, provider or global side effects. Must be called
 * with an already-created :memory: Node DatabaseSync instance containing
 * exactly the reviewed 25-migration QA source schema plus 3 draft number tables.
 * This is NOT an owner-authorized recovery of a complete app/photo archive.
 */
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES,
 validateNumberedCoreRecordsV2} from './numbered-records-v2-preflight.mjs';

const tables=Object.freeze([
 'customers','estimates','estimate_items','customer_notes','invoices',
 'invoice_items','invoice_revisions','payment_checkout_sessions','payments',
 'payment_refunds','deposit_policy_events','deposit_agreement_snapshots',
 'customer_photos','customer_messages','notifications','message_templates',
 'estimate_change_requests','tasks','expenses','job_reports',
 'fire_customer_numbers','fire_job_numbers','fire_job_estimate_links'
]);
const known=new Set([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES]);
if(tables.length!==known.size||new Set(tables).size!==known.size||
  tables.some(table=>!known.has(table)))throw Error('FIRE internal recovery table contract drift');
const blocked=reason=>{throw Error('FIRE disposable numbered restore blocked: '+reason);};
const canonical=(row,columns)=>JSON.stringify(columns.map(key=>row[key]));
const verifyRows=(db,archive,columns)=>{
 for(const table of tables){
  const stored=db.prepare('SELECT * FROM "'+table+'"').all();
  const expected=archive.tables[table];
  if(stored.length!==expected.length)blocked('stored '+table+' count differs');
  const layout=columns.get(table);
  const actual=stored.map(r=>canonical(r,layout)).sort();
  const source=expected.map(r=>canonical(r,layout)).sort();
  if(JSON.stringify(actual)!==JSON.stringify(source))
   blocked('stored '+table+' content differs');
 }
 for(const [table,expected] of [['fire_customer_numbers',archive.highWater.customer],
                                 ['fire_job_numbers',archive.highWater.job]]){
  const saved=db.prepare("SELECT seq FROM sqlite_sequence WHERE name=?").get(table)?.seq??0;
  if(saved!==expected)blocked('permanent serial high-water differs');
 }
 if(db.prepare('PRAGMA foreign_key_check').all().length)blocked('foreign key check failed');
 if(db.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok')
   blocked('SQLite integrity check failed');
};
const setHighWater=(db,table,sequence)=>{
 const updated=db.prepare('UPDATE sqlite_sequence SET seq=? WHERE name=?').run(sequence,table);
 if(updated.changes===0){
  db.prepare('INSERT INTO sqlite_sequence(name,seq) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name=?)')
    .run(table,sequence,table);
 }
};

/** Restore ONLY to an empty :memory: DB, with no attached database or unknown
 * tables. All writes and post-restore verification are inside ONE transaction.
 * A test-only interrupt can simulate a crash before COMMIT. It is never a
 * hosted, complete-photo, private backup, or operator-approved restore path.
 */
export function restoreNumberedCoreV2ToDisposableMemory(db,archive,options={}){
 if(!db||typeof db.prepare!=='function'||typeof db.exec!=='function')
  blocked('a Node in-memory SQLite connection is required');
 if(options==null||typeof options!=='object'||Array.isArray(options)||
    Object.keys(options).some(k=>k!=='testInterruptAfterRows'))
  blocked('unreviewed restore options');
 const interruption=options.testInterruptAfterRows;
 if(interruption!==undefined&&(!Number.isSafeInteger(interruption)||interruption<1))
  blocked('invalid synthetic interruption');
 const drives=db.prepare('PRAGMA database_list').all();
 // SQLite may internally materialize its own transient "temp" schema
 // after a PRAGMA or a completed transaction. It is not an attached DB.
 // Permit ONLY main+temp with blank paths, never arbitrary ATTACH names/files.
 if(drives.filter(d=>d.name==='main'&&d.file==='').length!==1||
    drives.some(d=>d.file!==''||!['main','temp'].includes(d.name)))
  blocked('only an unattached in-memory SQLite database is permitted');
 // Validate all data before the first insertion or BEGIN. Do not trust a
 // self-declared manifest alone; actual record relationships are checked.
 const summary=validateNumberedCoreRecordsV2(archive);
 const available=db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
 ).all().map(r=>r.name);
 const allowed=new Set([...tables,'auth_rate_limits']);
 if(available.length!==allowed.size||available.some(name=>!allowed.has(name)))
  blocked('reviewed exact QA baseline plus numbering schema is required');
 const hasTriggers=db.prepare(
  "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name IN ("+
  "'fire_customer_numbers_no_update','fire_customer_numbers_no_delete',"+
  "'fire_job_numbers_no_update','fire_job_numbers_no_delete',"+
  "'fire_job_estimate_links_no_update','fire_job_estimate_links_no_delete')"
 ).get()?.n;
 if(hasTriggers!==6)blocked('permanent identity immutability triggers missing');
 const columns=new Map();
 for(const table of tables){
  if(db.prepare('SELECT COUNT(*) AS n FROM "'+table+'"').get().n!==0)
   blocked('target durable table '+table+' is not empty');
  const actual=db.prepare('PRAGMA table_info("'+table+'")').all().map(r=>r.name);
  if(!actual.length)blocked('missing table columns '+table);
  const accepted=new Set(actual);
  for(const row of archive.tables[table]){
   const keys=Object.keys(row);
   if(keys.length!==actual.length||keys.some(k=>!accepted.has(k)))
    blocked('unverified/missing original SQL columns in '+table);
  }
  columns.set(table,actual);
 }
 if(db.prepare('SELECT COUNT(*) AS n FROM auth_rate_limits').get().n!==0)
  blocked('operational state must not exist in destination');
 if(db.prepare("SELECT COUNT(*) AS n FROM sqlite_sequence").get().n!==0)
  blocked('preexisting SQLite sequence state cannot be overwritten');
 if(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys!==1)
  blocked('foreign key checks must be enabled before restore');
 let inserted=0;
 db.exec('BEGIN IMMEDIATE');
 try{
  for(const table of tables){
   for(const row of archive.tables[table]){
    const layout=columns.get(table);
    const sql='INSERT INTO "'+table+'" ('+layout.map(x=>'"'+x+'"').join(',')+
      ') VALUES ('+layout.map(()=>'?').join(',')+')';
    db.prepare(sql).run(...layout.map(x=>row[x]));
    inserted++;
    if(interruption===inserted)throw Error('FIRE synthetic interrupted restore');
   }
  }
  setHighWater(db,'fire_customer_numbers',archive.highWater.customer);
  setHighWater(db,'fire_job_numbers',archive.highWater.job);
  verifyRows(db,archive,columns);
  db.exec('COMMIT');
  return Object.freeze({...summary,disposableOnly:true,
    completedAtomicInMemoryRestore:true,hostedWritesPerformed:false,
    completeAppAndPhotoRecoveryVerified:false});
 }catch(err){
  try{db.exec('ROLLBACK');}catch{blocked('rollback failed; discard disposable test database');}
  throw err;
 }
}
