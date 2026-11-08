/** FIRE Gate 6: OWNER-RUN hosted QA share isolation evidence.
 * Run on the owner's Acer with Node 22+:
 *   node business-app-parity/owner_gate6_hosted_readonly.mjs
 *
 * READ-ONLY. Public GETs may set first-view timestamps: supply ONLY exact
 * synthetic links you have ALREADY opened. Never use LIVE, customer records,
 * credentials or raw customer links from chat. No token is printed or saved.
 * This is hosted observation, NOT hosted source, nonowner identity or release proof.
 */
import {emitKeypressEvents} from 'node:readline';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const QA_ORIGIN='https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev';
export const DOC_KINDS=Object.freeze(['estimate','invoice','pay']);

export function validateViewedLink(value,kind){
  if(!DOC_KINDS.includes(kind))throw Error('Unsupported document kind');
  if(typeof value!=='string'||!value||/[\s\x00-\x1f]/.test(value))
    throw Error('Missing or invalid URL');
  let u;
  try{u=new URL(value);}catch{throw Error('Invalid URL');}
  if(u.origin!==QA_ORIGIN||u.username||u.password||u.search||u.hash||
    u.port||!u.pathname.startsWith('/'+kind+'/'))
    throw Error('Not a plain QA-only '+kind+' link');
  const parts=u.pathname.split('/');
  if(parts.length!==3||parts[0]!==''||parts[1]!==kind||
    !/^[A-Za-z0-9_-]{16,128}$/.test(parts[2])||u.href!==QA_ORIGIN+u.pathname)
    throw Error('Invalid QA-only '+kind+' path');
  return u.href;
}

export function examineDocument(html,ownMarker,otherMarker){
  if(typeof html!=='string'||html.length<30||html.length>2_000_000)
    return {ok:false,reason:'invalid page'};
  if(!html.includes(ownMarker))return {ok:false,reason:'own marker absent'};
  if(html.includes(otherMarker))return {ok:false,reason:'other customer marker present'};
  const ownerHints=['owner-preview-banner','owner-estimate-preview-close',
    'owner-invoice-preview-close','openCustomer=','openInvoice='];
  if(ownerHints.some(v=>html.includes(v)))return {ok:false,reason:'owner navigation exposed'};
  return {ok:true,reason:'only own marker and no owner controls'};
}

function safeGet(url,headers={}){
  return fetch(url,{method:'GET',redirect:'manual',cache:'no-store',
    headers,signal:AbortSignal.timeout(15000)});
}

export async function visiblePrompt(message,{input=process.stdin,output=process.stdout}={}){
  // node:readline's callback API returns undefined without a callback;
  // use the real promise-based interface so consent is read, never skipped.
  const rl=createInterface({input,output});
  try{
    const answer=await rl.question(message);
    return answer.trim();
  }finally{rl.close();}
}

async function hiddenPrompt(message){
  if(!process.stdin.isTTY||!process.stdout.isTTY)
    throw Error('Run this interactively in your private Acer terminal');
  return new Promise((resolveValue,reject)=>{
    let value='';
    const stdin=process.stdin;
    const wasRaw=stdin.isRaw;
    const onKey=(_key,key={})=>{
      if(key.ctrl&&key.name==='c'){
        cleanup();
        reject(Error('Cancelled by owner'));
      }else if(key.name==='return'||key.name==='enter'){
        cleanup();
        process.stdout.write('\n');
        resolveValue(value);
      }else if(key.name==='backspace'||key.name==='delete'){
        value=value.slice(0,-1);
      }else if(typeof _key==='string'&&_key.length===1&&!/[\x00-\x1f]/.test(_key)){
        if(value.length<500)value+=_key;
      }
    };
    function cleanup(){
      stdin.off('keypress',onKey);
      if(stdin.isTTY)stdin.setRawMode(Boolean(wasRaw));
    }
    process.stdout.write(message+' (hidden): ');
    emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('keypress',onKey);
  });
}

async function run(){
  if(!process.stdin.isTTY||!process.stdout.isTTY)
    throw Error('Use a private interactive terminal on the Acer (not CI)');
  process.stdout.write('FIRE QA Gate 6 — OWNER READ-ONLY, SYNTHETIC DATA ONLY\n');
  process.stdout.write('No browser cookies, private account logins, D1 writes or Stripe.\n');
  process.stdout.write('Only already-opened synthetic public links are allowed.\n');
  const yes=await visiblePrompt('Confirm all records are fictional QA customers (type YES): ');
  if(yes!=='YES')throw Error('STOP — synthetic-only confirmation not given');
  const markers=[];
  for(const letter of ['A','B']){
    const marker=await visiblePrompt('Customer '+letter+' synthetic name as shown on public page: ');
    if(marker.length<5||marker.length>120||/[\r\n]/.test(marker))
      throw Error('STOP — invalid synthetic customer marker');
    markers.push(marker);
  }
  if(markers[0]===markers[1]||markers[0].includes(markers[1])||markers[1].includes(markers[0]))
    throw Error('STOP — two distinct, non-overlapping customer names required');

  const targets=[];
  for(const [index,letter] of ['A','B'].entries()){
    for(const kind of DOC_KINDS){
      const raw=await hiddenPrompt('Customer '+letter+' ALREADY VIEWED '+kind+' link, or Enter to skip');
      if(!raw)continue;
      const url=validateViewedLink(raw,kind);
      const consent=await visiblePrompt('Was this EXACT '+kind+' link previously opened in QA? type YES: ');
      if(consent!=='YES')throw Error('STOP — never-viewed link refused before any request');
      targets.push({letter,index,kind,url});
    }
  }
  const kinds=DOC_KINDS.filter(kind=>targets.some(t=>t.kind===kind&&t.index===0)&&
    targets.some(t=>t.kind===kind&&t.index===1));
  if(!kinds.length)throw Error('STOP — need matching previously viewed link types for A and B');
  const unique=new Set(targets.map(x=>x.kind+':'+x.url));
  if(unique.size!==targets.length)throw Error('STOP — duplicate exact link supplied');
  // URL/header validation is complete before ANY network request.
  process.stdout.write('All selected links validated and confirmed as previously viewed.\n');
  let identity=false;
  try{
    const response=await safeGet(QA_ORIGIN+'/manifest.webmanifest');
    if(response.status===200){
      const manifest=await response.json();
      identity=manifest?.id==='/fire-synthetic-qa-v1'&&
        typeof manifest.name==='string'&&manifest.name.includes('QA');
    }
  }catch{}
  if(!identity)throw Error('STOP — expected public QA manifest identity not verified');
  process.stdout.write('PASS: public synthetic QA manifest identity\n');

  let passed=0,failed=0;
  for(const target of targets){
    try{
      const response=await safeGet(target.url);
      if(response.status!==200){
        process.stdout.write('FAIL '+target.letter+' '+target.kind+': unexpected HTTP status\n');
        failed++;continue;
      }
      const html=await response.text();
      const result=examineDocument(html,markers[target.index],markers[1-target.index]);
      if(result.ok){passed++;process.stdout.write('PASS '+target.letter+' '+target.kind+' isolation\n');}
      else{failed++;process.stdout.write('FAIL '+target.letter+' '+target.kind+': '+result.reason+'\n');}
    }catch{
      failed++;process.stdout.write('FAIL '+target.letter+' '+target.kind+': network check unsuccessful\n');
    }
  }
  // A forged header/cookie proves only invalid-session denial, NOT a true
  // distinct signed-in nonowner identity. Do not expose real cookies.
  let denied=false;
  try{
    const response=await safeGet(QA_ORIGIN+'/api/customers',{
      'oai-authenticated-user-email':'nonowner@example.invalid',
      'authorization':'Bearer forged-synthetic-gate6-invalid',
      'cookie':'fire_qa_session=v1.9999999999.invalid-signature'
    });
    denied=response.status===401||response.status===403;
  }catch{}
  process.stdout.write((denied?'PASS':'FAIL')+': forged synthetic owner header / cookie denied\n');
  if(!denied)failed++;
  const coverage=DOC_KINDS.filter(kind=>kinds.includes(kind)&&targets.filter(t=>t.kind===kind).length===2);
  process.stdout.write('\nSANITIZED RESULT (no links, names, tokens, cookies or contents):\n');
  process.stdout.write(JSON.stringify({time:new Date().toISOString(),
    qaManifest:true,observedDocuments:targets.length,crossCustomerTypes:coverage,
    passedDocuments:passed,failedChecks:failed,forgedSessionDenied:denied,
    hostedSourceVerified:false,trueDistinctNonownerTested:false,
    qaLiveOriginIsolationVerified:false,gate6Closed:false},null,2)+'\n');
  if(failed)process.exitCode=1;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  run().catch(err=>{process.stderr.write('STOP: '+String(err.message||'Failed')+'\n');process.exitCode=1;});
}
