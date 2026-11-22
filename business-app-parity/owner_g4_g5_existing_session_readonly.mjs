/**
 * FIRE owner Acer: one EXISTING Wrangler session for TWO genuinely outstanding
 * hosted evidence gaps: G5 STAGING migration journal and G4 account-wide DARK
 * DR/NEW LIVE ingress. No browser login, account change, migration or paid R2.
 *
 * Default invocation is offline. --capture requires interactive owner Windows.
 * A failure in either collector does not discard the other collector's evidence.
 * All token values remain in process memory; never log CLI/provider errors.
 */
import {existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readExistingWranglerToken,captureBothDarkExposures}
 from './owner_current_dark_exposure_existing_session.mjs';
import {captureStagingJournal,STAGING_DB}
 from './owner_staging_journal_existing_session_readonly.mjs';

const fail=()=>{throw Error('FIRE G4/G5 read-only STOP: existing session unavailable or invalid')};
export async function captureG4G5MissingEvidence({
 token,readStaging=captureStagingJournal,readDark=captureBothDarkExposures
}={}){
 if(typeof token!=='string'||token.length<20||token.length>4096||/\s/.test(token)||
    typeof readStaging!=='function'||typeof readDark!=='function')fail();
 let staging,exposure;
 try{staging=await readStaging({token})}
 catch{staging={result:'STAGING_READONLY_STOP',gate5Accepted:false}}
 try{exposure=await readDark({token})}
 catch{exposure={result:'DARK_ACCOUNT_READONLY_STOP',gate4Accepted:false}}
 const stagingVerified=staging?.physicalDatabaseIdentityBeforeAfterVerified===true&&
  staging?.target===STAGING_DB&&staging?.sqlReadOnly===true&&
  staging?.providerWrites===false&&
  (staging?.journalCount===22||staging?.journalCount===25);
 const ingressInventoryVerified=exposure?.providerReadbackVerified===true&&
  exposure?.completeInventoryFromSuppliedEvidence===true;
 const darkEndpointsAbsent=ingressInventoryVerified&&
  exposure?.publicEndpointsAbsentInSuppliedEvidence===true;
 return Object.freeze({
  result:!stagingVerified||!ingressInventoryVerified?
   'G4_G5_INCOMPLETE_REVIEW_REQUIRED':
   darkEndpointsAbsent?'G4_G5_READONLY_EVIDENCE_CAPTURED_FOR_REVIEW':
   'G4_G5_PUBLIC_ENDPOINTS_REQUIRE_REVIEW',
  stagingJournal:staging,accountWideDarkExposure:exposure,
  stagingJournalCaptured:stagingVerified,
  accountWideInventoryCaptured:ingressInventoryVerified,
  darkPublicEndpointsAbsent:darkEndpointsAbsent,
  providerContacted:true,providerWrites:false,loginAttempted:false,
  tokenStored:false,tokenDisplayed:false,
  gate4Accepted:false,gate5Accepted:false,releaseAuthorized:false,
  newLivePublic:false
 });
}
/**
 * G4-only owner follow-up AFTER an accepted STAGING journal capture.
 * Deliberately never calls STAGING or Wrangler: one explicit Cloudflare
 * read-only token, only both DARK Workers' account-wide GET inventory.
 * Failures remain private. Prior G5 evidence is neither invalidated nor rerun.
 */
export async function captureG4DarkOnlyEvidence({token,readDark=captureBothDarkExposures}={}){
 if(typeof token!=='string'||token.length<20||token.length>4096||/\s/.test(token)||
    typeof readDark!=='function')fail();
 let exposure;
 try{exposure=await readDark({token})}
 catch{exposure={result:'DARK_ACCOUNT_READONLY_STOP',gate4Accepted:false}}
 const complete=exposure?.providerReadbackVerified===true&&
  exposure?.completeInventoryFromSuppliedEvidence===true;
 return Object.freeze({
  result:!complete?'G4_DARK_ACCOUNT_READONLY_STOP':
   exposure?.publicEndpointsAbsentInSuppliedEvidence===true?
   'G4_DARK_ACCOUNT_EVIDENCE_CAPTURED_FOR_REVIEW':
   'G4_DARK_PUBLIC_ENDPOINTS_REQUIRE_REVIEW',
  accountWideDarkExposure:exposure,
  accountWideInventoryCaptured:complete,
  darkPublicEndpointsAbsent:complete&&
   exposure?.publicEndpointsAbsentInSuppliedEvidence===true,
  stagingJournalNotQueried:true,
  providerContacted:true,providerWrites:false,loginAttempted:false,
  tokenStored:false,tokenDisplayed:false,
  gate4Accepted:false,gate5Accepted:false,releaseAuthorized:false,
  newLivePublic:false
 });
}
/**
 * Optional no-Wrangler fallback: an owner-managed API token in a temporary
 * PowerShell environment variable. The code does not create, print or store
 * it. Actual read permissions are limited by Cloudflare's token scopes.
 */
export function readOwnerApiTokenFromEnvironment(env=process.env){
 const v=env?.CLOUDFLARE_API_TOKEN;
 if(typeof v!=='string'||v.length<20||v.length>4096||/\s/.test(v))fail();
 return v;
}
function npmCli(){
 const options=[
  join(dirname(process.execPath),'node_modules','npm','bin','npx-cli.js'),
  join(dirname(process.execPath),'..','lib','node_modules','npm','bin','npx-cli.js')
 ];
 return options.find(existsSync)||fail();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const args=process.argv.slice(2);
  if(args.length===0){
   console.log(JSON.stringify({result:'OFFLINE_NO_PROVIDER',
    target:STAGING_DB,captureOption:'--capture',fallbackOption:'--capture-env-token',darkOnlyOption:'--capture-dark-env-token',
    providerContacted:false,
    providerWrites:false,loginAttempted:false,gate4Accepted:false,gate5Accepted:false}));
  }else if(args.length===1&&args[0]==='--capture-dark-env-token'){
   if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||
      process.env.CI||process.env.GITHUB_ACTIONS)fail();
   const receipt=await captureG4DarkOnlyEvidence({
    token:readOwnerApiTokenFromEnvironment()
   });
   console.log(JSON.stringify(receipt,null,2));
   if(!receipt.darkPublicEndpointsAbsent)process.exitCode=2;
  }else if(args.length===1&&
            (args[0]==='--capture'||args[0]==='--capture-env-token')){
   if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||
      process.env.CI||process.env.GITHUB_ACTIONS)fail();
   const token=args[0]==='--capture-env-token'?
    readOwnerApiTokenFromEnvironment():
    readExistingWranglerToken({npmCli:npmCli()});
   const receipt=await captureG4G5MissingEvidence({token});
   console.log(JSON.stringify(receipt,null,2));
   if(!receipt.stagingJournalCaptured||!receipt.darkPublicEndpointsAbsent)
    process.exitCode=2;
  }else fail();
 }catch{
  console.error('FIRE G4/G5 READ-ONLY STOP: no verified combined proof. No login, retry, migration, route, Worker, Stripe or storage write.');
  process.exitCode=1;
 }
}
