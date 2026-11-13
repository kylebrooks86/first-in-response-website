/**
 * FIRE Job # QA25: NATIVE WRANGLER LOCAL D1 migration safety acceptance.
 *
 * Synthetic data ONLY, in a newly created temporary directory, with its own
 * fabricated local binding and UUID. No Cloudflare login or remote calls,
 * customer archives, LIVE/D1/photo access, uploads, migration permissions or
 * feature flags. Never reuse the existing QA Wrangler config or persist dir.
 */
import assert from 'node:assert/strict';
import {JOB_NUMBER_FOR_ESTIMATE_SQL,JOB_REFERENCE_BY_INVOICE_SQL,COMPLETED_JOB_COUNT_SQL} from '../lib/job-numbering.mjs';
import {spawnSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const rootSource=fileURLToPath(new URL('../../',import.meta.url));
const appDir=resolve(process.argv[2]??'');
const wrangler=join(appDir,'node_modules/wrangler/bin/wrangler.js');
assert.ok(process.argv[2] && existsSync(wrangler),
  'Installed PINNED Wrangler required in disposable materialized staging app.');
const migrationsDir=join(rootSource,'adapters/doomsday/drizzle');
const migrations=readdirSync(migrationsDir).filter(x=>/^\d{4}_[a-z0-9_]+\.sql$/.test(x)).sort();
assert.equal(migrations.length,25,'Expected the precise current QA25 migration family');
assert.ok(migrations[0].startsWith('0000_') && migrations.at(-1).startsWith('0024_'));
for(let i=0;i<25;i++)assert.equal(Number(migrations[i].slice(0,4)),i);
const candidate=join(rootSource,'job-numbering/qa25_job_numbers_seven_job_d1_candidate.sql');
const cleanCandidate=join(rootSource,'job-numbering/empty_prelaunch_job_numbers_qa25_d1_candidate.sql');
const candidateSql=readFileSync(candidate,'utf8');
const cleanSql=readFileSync(cleanCandidate,'utf8');
assert.ok(cleanSql.includes('CREATE TABLE fire_job_numbers'));
assert.ok(!/^\\s*(BEGIN|COMMIT)\\s[^;]*;/mi.test(cleanSql),
  'Empty prelaunch D1 candidate must not use raw transaction statements');
assert.ok(candidateSql.includes('CREATE TABLE fire_job_numbers'));
assert.ok(!/^\s*(BEGIN|COMMIT)\s[^;]*;/mi.test(candidateSql),
  'D1 migration must have no explicit transaction');
const temp=mkdtempSync(join(tmpdir(),'fire-synthetic-job-d1-native-'));
const env={
  ...process.env,CI:'true',
  CLOUDFLARE_API_TOKEN:'',CLOUDFLARE_ACCOUNT_ID:'',
  CF_API_TOKEN:'',CF_ACCOUNT_ID:'',CLOUDFLARE_PROFILE:'',
  WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false',
  CLOUDFLARE_CF_FETCH_ENABLED:'false'
};
let checks=0;
function run(ctx,parts,{allowFailure=false}={}){
  assert.equal(parts[0],'d1');
  assert.ok(['migrations','execute'].includes(parts[1]),'Only local D1 calls permitted');
  assert.ok(parts.includes('--local'),'Remote provider calls strictly forbidden');
  assert.ok(!parts.includes('--remote')&&!parts.includes('--preview'));
  assert.ok(parts.includes('--config')&&parts.includes(ctx.config));
  assert.ok(parts.includes('--persist-to')&&parts.includes(ctx.persist));
  assert.ok(!parts.includes('fire-fullapp-qa-20261016'));
  assert.ok(!parts.includes('fire-fullapp-qa-db-20261016'));
  const p=spawnSync(process.execPath,[wrangler,...parts],{
    cwd:ctx.dir,env,encoding:'utf8',timeout:150000,maxBuffer:6*1024*1024
  });
  if(p.error || (p.status!==0&&!allowFailure)){
    const log=(p.stderr||'')+'\n'+(p.stdout||'');
    throw new Error('Synthetic local Wrangler operation failed: '+parts.slice(0,3).join(' ')+
      ' status='+p.status+' '+log.replaceAll(temp,'[local-test-only]').slice(-1400));
  }
  return p;
}
function call(ctx,args,opts){
  return run(ctx,[...args,'--local','--config',ctx.config,'--persist-to',ctx.persist],opts);
}
function query(ctx,sql){
  const p=call(ctx,['d1','execute','DB','--command',sql,'--json']);
  const parsed=JSON.parse(p.stdout);
  assert.ok(Array.isArray(parsed)&&parsed.every(x=>x.success!==false));
  return parsed.flatMap(x=>x.results??[]);
}
function scalar(ctx,sql){return query(ctx,sql)[0]?.n;}
function context(tag,uuid){
  const dir=join(temp,tag);
  const migration=join(dir,'migrations');
  const persist=join(dir,'state');
  mkdirSync(migration,{recursive:true});
  mkdirSync(persist,{recursive:true});
  for(const filename of migrations)copyFileSync(join(migrationsDir,filename),join(migration,filename));
  const config=join(dir,'wrangler.jsonc');
  const name='fire-offline-only-job-number-'+tag;
  writeFileSync(join(dir,'noop.js'),'export default {fetch(){return new Response("synthetic only")}}');
  writeFileSync(config,JSON.stringify({
    name,main:'./noop.js',compatibility_date:'2026-10-14',
    d1_databases:[{binding:'DB',database_name:name,database_id:uuid,
      migrations_dir:'migrations',migrations_table:'d1_migrations'}]
  },null,2));
  const ctx={dir,migration,persist,config};
  call(ctx,['d1','migrations','apply','DB']);checks++;
  assert.equal(scalar(ctx,'SELECT COUNT(*) AS n FROM d1_migrations'),25);checks++;
  return ctx;
}
function seed(ctx,count){
  const customers=Array.from({length:3},(_,i)=>
    "INSERT INTO customers(id,name,created_at) VALUES ('cust-"+(i+1)+"','Fully synthetic "+(i+1)+"','2026-10-"+String(i+1).padStart(2,'0')+"T09:00:00Z');");
  const estimates=Array.from({length:count},(_,i)=>{
    const n=i+1, id='quote-'+String(n).padStart(2,'0');
    const customer='cust-'+((n%3)+1);
    const date='2026-10-'+String(n+3).padStart(2,'0')+'T12:00:00Z';
    return "INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES ('"+
      id+"','"+customer+"','"+(n===2?'completed':'draft')+"',14000,0,14000,7000,'"+date+"');";
  });
  const invoice=[
    "INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,created_at) VALUES ('inv-01','quote-02','cust-3','sent',14000,'2026-10-05T14:00:00Z');"
  ];
  const payments=Array.from({length:3},(_,i)=>"INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES ('pay-"+
     String(i+1).padStart(2,'0')+"','quote-02','Deposit',7000,'paid','2026-10-"+
     String(i+6).padStart(2,'0')+"T14:00:00Z');");
  const path=join(ctx.dir,'synthetic-seed.sql');
  writeFileSync(path,[...customers,...estimates,...invoice,...payments].join('\n'));
  call(ctx,['d1','execute','DB','--file',path,'--yes']);checks++;
  assert.equal(scalar(ctx,'SELECT COUNT(*) AS n FROM customers'),3);
  assert.equal(scalar(ctx,'SELECT COUNT(*) AS n FROM estimates'),count);
  assert.equal(scalar(ctx,'SELECT COUNT(*) AS n FROM payments'),3);checks++;
}
function snapshot(ctx){
  return [
    ['customers',3],['invoices',1],['payments',3],['customer_photos',0]
  ].map(([t,count])=>{
    const rows=query(ctx,'SELECT * FROM '+t+' ORDER BY rowid');
    assert.equal(rows.length,count);
    return JSON.stringify(rows);
  }).join('\n');
}
function addCandidate(ctx,{empty=false}={}){
  copyFileSync(empty?cleanCandidate:candidate,join(ctx.migration,
    empty?'0025_fire_job_numbers_new_app_empty.sql':'0025_fire_job_numbers_qa_seven.sql'));
}
try{
  const good=context('seven','10000001-1111-4111-8111-000000000001');
  seed(good,7);
  const prior=snapshot(good);
  addCandidate(good);
  call(good,['d1','migrations','apply','DB']);checks++;
  assert.equal(scalar(good,'SELECT COUNT(*) AS n FROM d1_migrations'),26);
  assert.equal(scalar(good,'SELECT COUNT(*) AS n FROM fire_job_numbers'),7);
  assert.equal(scalar(good,'SELECT COUNT(*) AS n FROM fire_job_estimate_links'),7);
  assert.equal(scalar(good,"SELECT seq AS n FROM sqlite_sequence WHERE name='fire_job_numbers'"),7);
  assert.equal(scalar(good,
    "SELECT COUNT(DISTINCT l.job_number) AS n FROM fire_job_estimate_links l JOIN estimates e ON e.id=l.estimate_id WHERE e.status='completed'"),1);
  assert.equal(query(good,
    "SELECT job_number AS n,root_estimate_id FROM fire_job_numbers ORDER BY job_number").length,7);
  assert.equal(snapshot(good),prior,'All original synthetic records must remain byte-identical');
  assert.equal(query(good,'PRAGMA foreign_key_check').length,0);
  assert.equal(query(good,'SELECT quick_check FROM pragma_quick_check')[0]?.quick_check,'ok');
  checks+=9;
  const reject=call(good,['d1','execute','DB','--command',
    'DELETE FROM fire_job_numbers WHERE job_number=1','--yes'],{allowFailure:true});
  assert.notEqual(reject.status,0,'Immutable Job # deletion must fail');
  assert.equal(scalar(good,'SELECT COUNT(*) AS n FROM fire_job_numbers'),7);
  checks+=2;
  const next=join(good.dir,'new-synthetic-job.sql');
  writeFileSync(next,[
    "INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES ('quote-08','cust-2','draft',14000,0,14000,7000,'2026-10-12T12:00:00Z');",
    "INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES ('quote-08','2026-10-12T12:00:00Z');",
    "INSERT INTO fire_job_estimate_links(estimate_id,job_number) SELECT 'quote-08',job_number FROM fire_job_numbers WHERE root_estimate_id='quote-08';"
  ].join('\n'));
  call(good,['d1','execute','DB','--file',next,'--yes']);checks++;
  assert.equal(scalar(good,"SELECT job_number AS n FROM fire_job_estimate_links WHERE estimate_id='quote-08'"),8);checks++;

  // New genuine numbered work and its invoice must resolve through the
  // authoritative root, customer ownership and original immutable Job #.
  const syntheticQuery=(sql,id)=>{assert.equal((sql.match(/\?/g)||[]).length,1);return sql.replace('?',"'"+id+"'");};
  assert.equal(query(good,syntheticQuery(JOB_NUMBER_FOR_ESTIMATE_SQL,'quote-08'))[0]?.jobNumber,8);
  assert.equal(query(good,syntheticQuery(JOB_REFERENCE_BY_INVOICE_SQL,'inv-01'))[0]?.jobNumber,2);
  assert.equal(query(good,COMPLETED_JOB_COUNT_SQL)[0]?.completedJobs,1);
  checks+=3;

  // D1 relationship FKs do not by themselves enforce same-customer ownership.
  // A corrupted link must not disclose another customer's number or inflate
  // the owner's completed-job counter; no real DB or customer is accessed.
  const injected=join(good.dir,'synthetic-cross-customer-only.sql');
  writeFileSync(injected,[
    "INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES ('quote-cross','cust-1','completed',14000,0,14000,7000,'2026-10-13T12:00:00Z');",
    "INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES ('quote-cross',1);",
    "INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,created_at) VALUES ('inv-cross','quote-cross','cust-1','sent',14000,'2026-10-13T14:00:00Z');"
  ].join('\n'));
  call(good,['d1','execute','DB','--file',injected,'--yes']);checks++;
  assert.equal(query(good,syntheticQuery(JOB_NUMBER_FOR_ESTIMATE_SQL,'quote-cross')).length,0,
    'Wrong-owner estimate must not inherit somebody else\'s Job #');
  assert.equal(query(good,syntheticQuery(JOB_REFERENCE_BY_INVOICE_SQL,'inv-cross')).length,0,
    'Invoice attached through corrupt job ownership must not disclose a Job #');
  assert.equal(query(good,COMPLETED_JOB_COUNT_SQL)[0]?.completedJobs,1,
    'Wrong-owner completed quote may not inflate the genuine completed-job count');
  checks+=3;

  const bad=context('drift-six','10000002-1111-4111-8111-000000000002');
  seed(bad,6);
  const badBefore=snapshot(bad);
  addCandidate(bad);
  const rejected=call(bad,['d1','migrations','apply','DB'],{allowFailure:true});
  assert.notEqual(rejected.status,0,'Unexpected QA record count must fail');
  assert.equal(scalar(bad,'SELECT COUNT(*) AS n FROM d1_migrations'),25,
    'Rejected candidate may not advance 25-migration journal');
  assert.equal(scalar(bad,
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('fire_job_numbers','fire_job_estimate_links')"),0,
    'Rejected native migration must roll back ALL newly added tables');
  assert.equal(snapshot(bad),badBefore,'Failed native migration must preserve source rows');
  checks+=4;

  // A genuinely new, independent app must not inherit seven QA sample jobs.
  // Rehearse its no-data migration in a THIRD isolated local D1 namespace.
  const fresh=context('empty-prelaunch','10000003-1111-4111-8111-000000000003');
  // Local synthetic diagnostics only; print object names and INTEGER counts,
  // never rows, customer details, secrets or remote database identifiers.
  const objectNames=query(fresh,"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(row=>row.name);
  const coreNames=['customers','estimates','customer_notes','invoices','invoice_items','invoice_revisions','payment_checkout_sessions','payment_refunds','deposit_policy_events','deposit_agreement_snapshots','estimate_items','payments','customer_photos','customer_messages','notifications','message_templates','estimate_change_requests','tasks','expenses','job_reports'];
  const nonempty=coreNames.filter(table=>scalar(fresh,'SELECT COUNT(*) AS n FROM '+table)!==0);
  console.log('SYNTHETIC CLEAN D1 CHECK: '+JSON.stringify({objectNames,nonempty,journalCount:scalar(fresh,'SELECT COUNT(*) AS n FROM d1_migrations'),authCount:scalar(fresh,'SELECT COUNT(*) AS n FROM auth_rate_limits')}));
  addCandidate(fresh,{empty:true});
  call(fresh,['d1','migrations','apply','DB']);checks++;
  assert.equal(scalar(fresh,'SELECT COUNT(*) AS n FROM d1_migrations'),26);
  assert.equal(scalar(fresh,'SELECT COUNT(*) AS n FROM fire_job_numbers'),0);
  assert.equal(scalar(fresh,'SELECT COUNT(*) AS n FROM fire_job_estimate_links'),0);
  assert.equal(scalar(fresh,"SELECT COALESCE(MAX(seq),0) AS n FROM sqlite_sequence WHERE name='fire_job_numbers'"),0);
  checks+=4;
  const firstReal=join(fresh.dir,'synthetic-first-job.sql');
  writeFileSync(firstReal,[
    "INSERT INTO customers(id,name,created_at) VALUES ('brandnew-customer','Prelaunch fixture','2026-10-15T09:00:00Z');",
    "INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES ('brandnew-job','brandnew-customer','draft',10000,0,10000,5000,'2026-10-15T10:00:00Z');",
    "INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES ('brandnew-job','2026-10-15T10:00:00Z');",
    "INSERT INTO fire_job_estimate_links(estimate_id,job_number) SELECT 'brandnew-job',job_number FROM fire_job_numbers WHERE root_estimate_id='brandnew-job';"
  ].join('\n'));
  call(fresh,['d1','execute','DB','--file',firstReal,'--yes']);checks++;
  assert.equal(scalar(fresh,"SELECT job_number AS n FROM fire_job_estimate_links WHERE estimate_id='brandnew-job'"),1,
    'Clean real LIVE would start with #0001, never #0008 from QA');checks++;
  assert.equal(query(fresh,syntheticQuery(JOB_NUMBER_FOR_ESTIMATE_SQL,'brandnew-job'))[0]?.jobNumber,1);checks++;

  // An allegedly clean target containing even one prelaunch record MUST
  // reject this empty-only candidate, with D1 migration journal unchanged.
  const dirty=context('nonempty-rejected','10000004-1111-4111-8111-000000000004');
  seed(dirty,7);
  const dirtyRows=snapshot(dirty);
  addCandidate(dirty,{empty:true});
  const refused=call(dirty,['d1','migrations','apply','DB'],{allowFailure:true});
  assert.notEqual(refused.status,0);
  assert.equal(scalar(dirty,'SELECT COUNT(*) AS n FROM d1_migrations'),25);
  assert.equal(scalar(dirty,"SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='fire_job_numbers'"),0);
  assert.equal(snapshot(dirty),dirtyRows,'Refused clean migration must leave source history untouched');
  checks+=4;
  console.log('PASS: '+checks+' actual Wrangler LOCAL QA Job # #0008 rehearsal, clean new-app #0001 allocation, refusal on nonempty database, customer ownership and immutable numbering. NO REMOTE D1, EXPORT, DEPLOY OR REAL DATA.');
}finally{
  rmSync(temp,{recursive:true,force:true});
}
