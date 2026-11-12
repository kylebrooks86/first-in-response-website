/** Owner Acer bridge: existing Wrangler credential stays in local process memory.
 * Only the GET-only factory is invoked: no approval gate, POST, D1 SQL or Stripe.
 * Never run `wrangler auth token` directly and paste its output into chat.
 */
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPinnedFireGate9ReadOnlyApi} from './gate9_pinned_private_target.mjs';
import {WORKER,PREDECESSOR,DB_UUID} from './gate9_inactive_fullapp_contract.mjs';
const stop=code=>{throw Error('STOP: Gate9 private GET-only check ['+code+']; no upload attempted.');};
export function readExistingWranglerToken({spawn=spawnSync,platform=process.platform}={}){
  let r;
  try{
    const options={encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,
      maxBuffer:1024*1024,windowsHide:true,
      // Wrangler 4.151 prints --json via logger.log; error-only suppresses stdout.
      // Keep log output captured in pipes, and explicitly prohibit disk logging.
      env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG:'log',
        WRANGLER_WRITE_LOGS:'false'}};
    // Fixed command only. No user input, paths, tokens or shell interpolation.
    r=platform==='win32'?spawn('cmd.exe',['/d','/s','/c','wrangler.cmd auth token --json'],options):
      spawn('wrangler',['auth','token','--json'],options);
  }catch{stop('WRANGLER_AUTH_UNAVAILABLE');}
  if(r?.error||r?.status!==0||typeof r.stdout!=='string')stop('WRANGLER_AUTH_UNAVAILABLE');
  let parsed;
  try{parsed=JSON.parse(r.stdout);}catch{stop('WRANGLER_AUTH_FORMAT');}
  if(!['api_token','oauth'].includes(parsed?.type)||typeof parsed.token!=='string'||
    parsed.token.length<=10||parsed.token.length>=4096||/\s/.test(parsed.token))
    stop('BEARER_AUTH_REQUIRED');
  return parsed.token; // never returned by the CLI, printed, saved or sent to GitHub
}
export async function runOwnerPrivateReadOnly({reviewedSource,getHead,readToken,fetchImpl}){
  if(!/^[a-f0-9]{40}$/.test(reviewedSource)||/^0+$/.test(reviewedSource)||
    typeof getHead!=='function'||typeof readToken!=='function'||typeof fetchImpl!=='function')
    stop('INPUT');
  if(await getHead()!==reviewedSource)stop('SOURCE_MISMATCH');
  let privateToken;
  try{privateToken=await readToken();}catch{stop('PRIVATE_AUTH_UNAVAILABLE');}
  try{
    const adapter=createPinnedFireGate9ReadOnlyApi({tokenProvider:async()=>privateToken,fetchImpl});
    const state=await adapter.readState();
    return {readOnly:true,sourceSha:reviewedSource,worker:WORKER,
      activeVersion:state.version.id,activePercentage:state.versions[0].percentage,
      d1Uuid:state.version.resources.bindings.find(b=>b.name==='DB').id,
      stripeMode:state.version.resources.bindings.find(b=>b.name==='FIRE_STRIPE_MODE').text,
      accessRequired:state.version.resources.bindings.find(b=>b.name==='FIRE_ACCESS_REQUIRED').text,
      secretNames:state.version.resources.bindings.filter(b=>b.type==='secret_text').map(b=>b.name).sort(),
      expectedPinsMatch:state.version.id===PREDECESSOR&&
        state.version.resources.bindings.find(b=>b.name==='DB').id===DB_UUID,
      uploadAttempted:false,gate9Accepted:false};
  }finally{privateToken=undefined;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==4||process.argv[2]!=='--reviewed-source')stop('ARGS');
    const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
    const reviewedSource=process.argv[3];
    const getHead=()=>{
      const args=['-C',root];
      const dirty=spawnSync('git',[...args,'diff','HEAD','--quiet','--',
        'business-app-parity/cloudflare-launch/stripe-test-worker'],{stdio:'pipe',timeout:10000});
      if(dirty.status!==0)stop('LOCAL_TRACKED_CHANGES');
      const r=spawnSync('git',[...args,'rev-parse','HEAD'],{encoding:'utf8',stdio:'pipe',timeout:10000});
      if(r.status!==0)stop('SOURCE_UNAVAILABLE');
      return r.stdout.trim();
    };
    const result=await runOwnerPrivateReadOnly({reviewedSource,getHead,
      readToken:()=>readExistingWranglerToken(),fetchImpl:fetch});
    console.log(JSON.stringify(result,null,2));
  }catch(error){
    const safe=error instanceof Error&&/^STOP: Gate9 (?:private GET-only check|Cloudflare READ ONLY) \[[A-Z_]+\]/.test(error.message);
    console.error(safe?error.message:'STOP: Gate9 private GET-only check [UNVERIFIED]; no upload attempted.');
    process.exitCode=1;
  }
}
