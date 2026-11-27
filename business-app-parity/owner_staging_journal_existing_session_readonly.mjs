/**
 * FIRE G5-01 targeted, OWNER-ONLY STAGING journal proof via an EXISTING Wrangler
 * session. No browser login, no new token, no Cloudflare/Stripe/D1 mutations.
 * Offline default: node ...mjs
 * Read-only capture (owner's private Windows console): node ...mjs --capture
 * The only SQL is the pinned SELECT of d1_migrations.id/name; no business rows.
 * This proof does not authorize migration or accept Gate 5.
 */
import {existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {readExistingWranglerToken} from './owner_current_dark_exposure_existing_session.mjs';

export const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
export const STAGING_DB='fire-app-staging-db';
export const STAGING_UUID='afb2c05a-d794-4a9a-b580-924ce01c26ad';
export const SELECT_ONLY='SELECT id, name FROM d1_migrations ORDER BY id';
export const REVIEWED_MIGRATIONS=Object.freeze([
 '0000_wise_namora.sql','0001_elite_cammi.sql','0002_tearful_ink.sql',
 '0003_absent_dracula.sql','0004_volatile_fenris.sql',
 '0005_unknown_king_cobra.sql','0006_open_solo.sql',
 '0007_open_bloodaxe.sql','0008_typical_tomorrow_man.sql',
 '0009_spicy_micromax.sql','0010_discount_mode.sql',
 '0011_editable_invoices.sql','0012_invoice_revisions.sql',
 '0013_checkout_sessions.sql','0014_notification_resolution.sql',
 '0015_single_open_checkout.sql','0016_notification_resolution_note.sql',
 '0017_one_invoice_per_estimate.sql','0018_payment_refunds.sql',
 '0019_refund_ledger_unique.sql','0020_notification_lifecycle_unique.sql',
 '0021_manual_processing_fees.sql','0022_stripe_provider_uniqueness.sql',
 '0023_deposit_policy_events.sql','0024_deposit_agreement_snapshots.sql'
]);
const fail=()=>{throw Error('STOP: STAGING journal identity, API, or applied order cannot be verified; no writes made')};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function validateD1Identity(data){
 if(!obj(data)||data.success!==true||!Array.isArray(data.errors)||data.errors.length||
    !obj(data.result)||data.result.name!==STAGING_DB||data.result.uuid!==STAGING_UUID)fail();
 return true;
}
export function evaluateMigrationJournal(data){
 if(!obj(data)||data.success!==true||!Array.isArray(data.errors)||data.errors.length||
    !Array.isArray(data.result)||data.result.length!==1)fail();
 const result=data.result[0];
 if(!obj(result)||result.success!==true||!Array.isArray(result.results)||
    result.meta?.rows_written>0||result.meta?.changes>0||result.meta?.changed_db===true)fail();
 const rows=result.results;
 if(rows.length!==22&&rows.length!==25)fail();
 let last=0;
 for(let i=0;i<rows.length;i++){
  const r=rows[i];
  if(!obj(r)||!Number.isSafeInteger(r.id)||r.id<=last||
     r.name!==REVIEWED_MIGRATIONS[i])fail();
  last=r.id;
 }
 const names=rows.map(r=>r.name);
 return Object.freeze({
  result:rows.length===22?'STAGING_22_OF_25_PINNED_JOURNAL_VERIFIED':'STAGING_25_OF_25_PINNED_JOURNAL_VERIFIED',
  target:STAGING_DB,databaseUuid:STAGING_UUID,
  orderedIds:rows.map(r=>r.id),orderedNames:names,
  journalCount:rows.length,reviewedTargetCount:25,
  pendingMigrationNames:REVIEWED_MIGRATIONS.slice(rows.length),
  journalSha256:createHash('sha256').update(rows.map(r=>r.id+'|'+r.name).join('\n')).digest('hex'),
  noCustomerRowsRead:true,sqlStatement:SELECT_ONLY,
  sqlReadOnly:true,providerWrites:false,loginAttempted:false,
  hostedWorkerBindingVerified:false,gate5Accepted:false,releaseAuthorized:false
 });
}
export async function captureStagingJournal({token,request=fetch}={}){
 if(typeof token!=='string'||token.length<20||token.length>4096||/\s/.test(token))fail();
 if(typeof request!=='function')fail();
 const root='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/d1/database/'+STAGING_UUID;
 async function call(path,method='GET',body=undefined){
  const response=await request(root+path,{method,
   headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{}),
   redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response||!response.ok)fail();
  const raw=await response.text();
  if(raw.length>100000)fail();
  try{return JSON.parse(raw)}catch{fail()}
 }
 validateD1Identity(await call(''));
 const journal=evaluateMigrationJournal(await call('/query','POST',{sql:SELECT_ONLY}));
 validateD1Identity(await call(''));
 return Object.freeze({...journal,physicalDatabaseIdentityBeforeAfterVerified:true});
}
function npmCli(){
 const candidates=[
  join(dirname(process.execPath),'node_modules','npm','bin','npx-cli.js'),
  join(dirname(process.execPath),'..','lib','node_modules','npm','bin','npx-cli.js')
 ];
 const found=candidates.find(existsSync);
 if(!found)fail();
 return found;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const args=process.argv.slice(2);
  if(args.length===0){
   console.log(JSON.stringify({result:'OFFLINE_NO_PROVIDER',target:STAGING_DB,
    statement:SELECT_ONLY,providerContacted:false,loginAttempted:false,
    readOnlyCaptureOption:'--capture',gate5Accepted:false}));
  }else if(args.length===1&&args[0]==='--capture'){
   if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||
      process.env.CI||process.env.GITHUB_ACTIONS)fail();
   const token=readExistingWranglerToken({npmCli:npmCli()});
   const receipt=await captureStagingJournal({token});
   console.log(JSON.stringify(receipt,null,2));
  }else fail();
 }catch{
  console.error('FIRE STAGING READ-ONLY STOP: existing Wrangler credential or exact D1/journal proof unavailable. No login, retry, migration, secrets or write.');
  process.exitCode=1;
 }
}
