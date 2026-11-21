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
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS} from './new-live-migration-journal.mjs';

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

// The independent LIVE 26-row migration JOURNAL alone is not evidence that
// its immutable numbering and financial uniqueness SQL really exists.
// Check actual sqlite_master definitions in a disposable :memory: DB only.
const schemaSql=sql=>String(sql??'').replace(/[\x22\x60\s]/g,'')
 .replace(/;$/,'').toLowerCase();
const required26Triggers=Object.freeze([
 ['fire_customer_numbers_no_update','fire_customer_numbers','UPDATE','FIRE customer numbers are permanent'],
 ['fire_customer_numbers_no_delete','fire_customer_numbers','DELETE','FIRE customer numbers cannot be reused'],
 ['fire_job_numbers_no_update','fire_job_numbers','UPDATE','FIRE Job numbers cannot be renumbered'],
 ['fire_job_numbers_no_delete','fire_job_numbers','DELETE','FIRE Job numbers cannot be reused'],
 ['fire_job_estimate_links_no_update','fire_job_estimate_links','UPDATE','FIRE Job links cannot be reassigned'],
 ['fire_job_estimate_links_no_delete','fire_job_estimate_links','DELETE','FIRE Job links are permanent']
]);
// SQLite strips IF NOT EXISTS when persisting CREATE INDEX in sqlite_master.sql.
const required26Indexes=Object.freeze([
 ['idx_payment_checkout_sessions_one_open_per_estimate','payment_checkout_sessions',
  "CREATE UNIQUE INDEX idx_payment_checkout_sessions_one_open_per_estimate ON payment_checkout_sessions (estimate_id) WHERE status='open'"],
 ['idx_invoices_one_per_estimate','invoices',
  'CREATE UNIQUE INDEX idx_invoices_one_per_estimate ON invoices (estimate_id)'],
 ['idx_payment_refunds_payment_status','payment_refunds',
  'CREATE INDEX idx_payment_refunds_payment_status ON payment_refunds (payment_id,status)'],
 ['idx_payment_refunds_estimate_status','payment_refunds',
  'CREATE INDEX idx_payment_refunds_estimate_status ON payment_refunds (estimate_id,status)'],
 ['idx_payment_refunds_provider','payment_refunds',
  'CREATE UNIQUE INDEX idx_payment_refunds_provider ON payment_refunds (provider_refund_id) WHERE provider_refund_id IS NOT NULL'],
 ['idx_payments_unique_refund_provider','payments',
  "CREATE UNIQUE INDEX idx_payments_unique_refund_provider ON payments (provider_id) WHERE provider_id LIKE 'refund:%'"],
 ['idx_notifications_unique_lifecycle','notifications',
  "CREATE UNIQUE INDEX idx_notifications_unique_lifecycle ON notifications (type,estimate_id) WHERE estimate_id IS NOT NULL AND type IN ('estimate_viewed','invoice_viewed','estimate_accepted')"],
 ['idx_payments_stripe_provider_unique','payments',
  "CREATE UNIQUE INDEX idx_payments_stripe_provider_unique ON payments (provider_id) WHERE provider_id GLOB 'cs_*' OR provider_id GLOB 'refund:*'"],
 ['idx_fire_job_estimate_links_number','fire_job_estimate_links',
  'CREATE INDEX idx_fire_job_estimate_links_number ON fire_job_estimate_links(job_number)']
]);
// The migration journal, trigger names and index SQL cannot protect a table
// whose actual CREATE TABLE lost its FK, NOT NULL, refund-cents type, CHECK,
// UNIQUE or AUTOINCREMENT guarantees. These four definitions are pinned to
// reviewed 0018 + 0025 migrations; any future migration must be reviewed.
const required26TableDefinitions=Object.freeze([
 ['payment_refunds',`CREATE TABLE payment_refunds (
  id text PRIMARY KEY NOT NULL,
  payment_id text NOT NULL,
  estimate_id text NOT NULL,
  amount_cents integer NOT NULL,
  mode text NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  provider_refund_id text,
  note text,
  created_at text NOT NULL,
  completed_at text,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON UPDATE no action ON DELETE no action
 )`],
 ['fire_customer_numbers',`CREATE TABLE fire_customer_numbers (
  customer_number INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL UNIQUE REFERENCES customers(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at TEXT NOT NULL CHECK(length(created_at)>0)
 )`],
 ['fire_job_numbers',`CREATE TABLE fire_job_numbers (
  job_number INTEGER PRIMARY KEY AUTOINCREMENT,
  root_estimate_id TEXT NOT NULL UNIQUE REFERENCES estimates(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at TEXT NOT NULL CHECK(length(created_at)>0)
 )`],
 ['fire_job_estimate_links',`CREATE TABLE fire_job_estimate_links (
  estimate_id TEXT PRIMARY KEY NOT NULL REFERENCES estimates(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  job_number INTEGER NOT NULL REFERENCES fire_job_numbers(job_number) ON UPDATE RESTRICT ON DELETE RESTRICT
 )`]
]);
function assertIndependentLive26CriticalSchema(db){
 for(const [name,definition] of required26TableDefinitions){
  const found=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name);
  if(!found||schemaSql(found.sql)!==schemaSql(definition))
   blocked('NEW LIVE refund/permanent-number table DDL differs: '+name);
 }
 for(const [name,table,operation,message] of required26Triggers){
  const found=db.prepare("SELECT tbl_name,sql FROM sqlite_master WHERE type='trigger' AND name=?").get(name);
  const definition='CREATE TRIGGER '+name+' BEFORE '+operation+' ON '+table+
   " BEGIN SELECT RAISE(ABORT,'"+message+"'); END";
  if(!found||found.tbl_name!==table||schemaSql(found.sql)!==schemaSql(definition))
   blocked('NEW LIVE immutable-number trigger DDL differs: '+name);
 }
 for(const [name,table,definition] of required26Indexes){
  const found=db.prepare("SELECT tbl_name,sql FROM sqlite_master WHERE type='index' AND name=?").get(name);
  if(!found||found.tbl_name!==table||schemaSql(found.sql)!==schemaSql(definition))
   blocked('NEW LIVE payment/number index DDL differs: '+name);
 }
}

/** Restore ONLY to an empty :memory: DB, with no attached database or unknown
 * tables. All writes and post-restore verification are inside ONE transaction.
 * A test-only interrupt can simulate a crash before COMMIT. It is never a
 * hosted, complete-photo, private backup, or operator-approved restore path.
 */
export function restoreNumberedCoreV2ToDisposableMemory(db,archive,options={}){
 if(!db||typeof db.prepare!=='function'||typeof db.exec!=='function')
  blocked('a Node in-memory SQLite connection is required');
 if(options==null||typeof options!=='object'||Array.isArray(options)||
    Object.keys(options).some(k=>!['testInterruptAfterRows','schemaProfile'].includes(k)))
  blocked('unreviewed restore options');
 // The actual independent NEW LIVE 26-migration schema contains an ordered
 // d1_migrations journal, unlike the existing standalone QA-25 prototype.
 // Keep QA-25 as the default: selecting NEW LIVE must be explicit and cannot
 // auto-trust a same-named journal or silently delete it during a restore.
 const profile=options.schemaProfile??'qa-25';
 if(!['qa-25','independent-live-26'].includes(profile))
  blocked('unreviewed SQLite schema profile');
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
 // An empty SQLite TEMP schema is mandatory. Even with an unattached
 // :memory: main, a TEMP customers/payments table or view shadows the real
 // reviewed main table during unqualified INSERT/SELECT. sqlite_master does
 // NOT enumerate TEMP objects; reject them before any recovery transaction.
 // SQLite's internal transient temp schema is okay, user-defined objects are not.
 const tempObjects=db.prepare(
  "SELECT type,name FROM sqlite_temp_master WHERE type IN ('table','view','trigger','index')"
 ).all();
 if(tempObjects.length)
  blocked('temporary SQLite schema objects can shadow reviewed customer/financial tables');
 // Validate all data before the first insertion or BEGIN. Do not trust a
 // self-declared manifest alone; actual record relationships are checked.
 const summary=validateNumberedCoreRecordsV2(archive);
 const available=db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
 ).all().map(r=>r.name);
 const allowed=new Set([...tables,'auth_rate_limits',
  ...(profile==='independent-live-26'?['d1_migrations']:[])]);
 if(available.length!==allowed.size||available.some(name=>!allowed.has(name)))
  blocked(profile==='qa-25'
   ? 'reviewed exact QA baseline plus numbering schema is required'
   : 'reviewed exact NEW LIVE 26-migration schema and complete numbering tables required');
 if(profile==='independent-live-26'){
  // The ordered journal itself is provider/application operational metadata,
  // NOT part of the 23 customer/finance/photo records archive. It must
  // already exist from the 26 reviewed migrations, unchanged and in order;
  // source record restoration never inserts, rewrites or upgrades it.
  const columns=db.prepare('PRAGMA table_info("d1_migrations")').all();
  if(columns.length!==2||columns[0].name!=='id'||columns[1].name!=='name'||
     columns[0].pk!==1||columns[1].notnull!==1)
    blocked('NEW LIVE migration journal column structure differs');
  const journal=db.prepare('SELECT id,name FROM "d1_migrations" ORDER BY id').all();
  if(journal.length!==EXPECTED_NEW_LIVE_D1_MIGRATIONS.length||
     journal.some((row,i)=>row.id!==i+1||
       row.name!==EXPECTED_NEW_LIVE_D1_MIGRATIONS[i]))
    blocked('NEW LIVE exact 26-migration journal missing, reordered or forged');
 }
 const hasTriggers=db.prepare(
  "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name IN ("+
  "'fire_customer_numbers_no_update','fire_customer_numbers_no_delete',"+
  "'fire_job_numbers_no_update','fire_job_numbers_no_delete',"+
  "'fire_job_estimate_links_no_update','fire_job_estimate_links_no_delete')"
 ).get()?.n;
 if(hasTriggers!==6)blocked('permanent identity immutability triggers missing');
 if(profile==='independent-live-26')assertIndependentLive26CriticalSchema(db);
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
    schemaProfile:profile,
    reviewed26MigrationJournalPreserved:profile==='independent-live-26',
    completedAtomicInMemoryRestore:true,hostedWritesPerformed:false,
    completeAppAndPhotoRecoveryVerified:false,
    actualHostedRestorePerformed:false,gate7Accepted:false});
 }catch(err){
  try{db.exec('ROLLBACK');}catch{blocked('rollback failed; discard disposable test database');}
  throw err;
 }
}
