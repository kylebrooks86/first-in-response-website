// Owner-only STAGING inactive version CLI. No effect when imported.
// Execution is forbidden without a fresh exact owner authorization and local Windows consent.
// No tokens, private hashes, customer records or response payloads are printed/stored.
import {platform,tmpdir} from 'node:os';
import {env,argv,stdin} from 'node:process';
import {lstatSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {reviewOwnerLaunch} from './owner_staging_beta_launch_review.mjs';
import {uploadOneInactiveStagingVersion} from './staging_beta_one_inactive_upload.mjs';
import {createPrivateReaders,createReservation} from './staging_beta_private_bridge.mjs';
import {PIN} from './staging_beta_version_binding_contract.mjs';

export const RECEIPT='f811cc2d7e4b1c37e21d7d28d6aba31215897ac89f5a2e756fbf9e258c1d525a';
export const CONSENT='I AUTHORIZE ONE NEW INACTIVE STAGING UPLOAD ONLY';
const fail=code=>{throw Error('STAGING_OWNER_ONCE_STOP_'+code)};
const required=(ok,code)=>{if(!ok)fail(code)};
const exactNames=['DB','FIRE_SESSION_SECRET','STRIPE_SECRET_KEY','FIRE_ENV','SITE_ORIGIN','FIRE_STAGING_PRIVATE_ACTIVATION','FIRE_STRIPE_MODE','FIRE_ADMIN_PASSWORD_HASH'];

export function verifyInactiveBindings(v){
 required(v&&typeof v==='object'&&Array.isArray(v.resources?.bindings),'VERSION_BINDINGS');
 const b=v.resources.bindings;
 const names=b.map(x=>x?.name);
 required(names.length===exactNames.length&&new Set(names).size===names.length&&
   exactNames.every(n=>names.includes(n)),'EXTRA_OR_MISSING_BINDINGS');
 const get=n=>b.find(x=>x.name===n);
 required(get('DB').type==='d1'&&(get('DB').database_id??get('DB').id)===PIN.db,'DATABASE');
 for(const n of ['FIRE_SESSION_SECRET','STRIPE_SECRET_KEY','FIRE_ADMIN_PASSWORD_HASH']){
   const secret=get(n);
   required(secret.type==='secret_text'&&!Object.hasOwn(secret,'text')&&!Object.hasOwn(secret,'value'),'SECRET_SCOPE');
 }
 const texts={
   FIRE_ENV:'staging',
   SITE_ORIGIN:'https://fire-app-independent-staging.kyle-bfc.workers.dev',
   FIRE_STAGING_PRIVATE_ACTIVATION:'blocked',
   FIRE_STRIPE_MODE:'disabled'
 };
 for(const [name,value] of Object.entries(texts))
   required(get(name).type==='plain_text'&&get(name).text===value,'TEXT_BINDING');
 required(!b.some(x=>/^r2/i.test(x?.type??'')),'PAID_STORAGE');
 return true;
}

export async function runOwnerInactiveOnce({folder,privateDir,token,adminHash,consent,fetchImpl=fetch}){
 required(platform()==='win32'&&!env.CI&&!env.GITHUB_ACTIONS,'OWNER_WINDOWS');
 required(consent===CONSENT,'NEW_OWNER_CONSENT');
 required(typeof adminHash==='string'&&/^[a-f0-9]{64}$/.test(adminHash),'PRIVATE_HASH');
 required(typeof token==='string'&&token.length>=20&&token.length<=4096&&!/\s/.test(token),'PRIVATE_TOKEN');
 const root=resolve(folder);
 required(lstatSync(root).isDirectory()&&!lstatSync(root).isSymbolicLink(),'PACKAGE_PATH');
 const receiptPath=join(root,'staging-noassets-dark-source-receipt.json');
 required(createHash('sha256').update(readFileSync(receiptPath)).digest('hex')===RECEIPT,'PACKAGE_DIGEST');
 const readers=createPrivateReaders(token,fetchImpl);
 const uploaded=await uploadOneInactiveStagingVersion({
  folder:root,receiptPin:RECEIPT,adminHash,
  predecessor:await readers.readVersion(PIN.version),
  verifyPackage:async()=>{
   const proof=reviewOwnerLaunch(root,RECEIPT);
   return proof.result==='STAGING_FULLAPP_OFFLINE_BODY_READY'&&proof.receiptPin===RECEIPT&&
      proof.providerContacted===false&&proof.uploadAuthorized===false&&
      proof.freeWorkerSizePrerequisiteSatisfied===true;
  },
  readServing:readers.readServing,
  verifyNoDuplicate:readers.verifyNoDuplicate,
  permissionGate:async intent=>consent===CONSENT&&intent.worker===PIN.worker&&
    intent.activation===false&&intent.stripeMode==='disabled',
  reserveOnce:createReservation(privateDir),
  tokenProvider:async()=>token,fetchImpl
 });
 // An uploaded inactive version must still be read back as its own version.
 // If this or any provider reply is uncertain, the one-time lock remains spent.
 const version=await readers.readVersion(uploaded.newVersion);
 required(verifyInactiveBindings(version),'NEW_VERSION_SCOPE');
 return {result:'STAGING_INACTIVE_VERSION_CREATED_VERIFIED',
   worker:PIN.worker,newVersionId:uploaded.newVersion,
   predecessorVersionId:PIN.version,servingStill100Percent:true,
   stripesDisabledOnNewVersion:true,independentD1Preserved:true,
   activated:false,needsHostedAppParity:true};
}
async function readPrivateStdin(){
 let size=0,parts=[];
 for await(const piece of stdin){
  size+=piece.byteLength;
  required(size<=8192,'PRIVATE_INPUT_LIMIT');
  parts.push(piece);
 }
 let value;
 try{value=JSON.parse(Buffer.concat(parts).toString('utf8'))}
 catch{fail('PRIVATE_INPUT_JSON')}
 required(value&&typeof value==='object'&&
  ['token','adminHash','consent'].every(x=>Object.hasOwn(value,x))&&
  Object.keys(value).length===3,'PRIVATE_INPUT_FIELDS');
 return value;
}
async function main(){
 required(argv.length===4&&argv[2]==='--execute','CLI_ARGS');
 const directory=env.LOCALAPPDATA;
 required(typeof directory==='string'&&directory.length>4,'OWNER_PRIVATE_DIRECTORY');
 const p=await readPrivateStdin();
 const outcome=await runOwnerInactiveOnce({
  folder:argv[3],privateDir:join(directory,'FIRE-STAGING-Private'),
  token:p.token,adminHash:p.adminHash,consent:p.consent
 });
 console.log(JSON.stringify(outcome));
}
if(argv[1]&&import.meta.url===pathToFileURL(resolve(argv[1])).href){
 main().catch(e=>{
  const safe=/^STAGING_(?:OWNER_ONCE|UPLOAD|PRIVATE_BRIDGE|FULLAPP_BODY|BINDING_CONTRACT)_STOP_[A-Z0-9_]+$/.test(e?.message??'');
  console.error(safe?e.message:'STAGING_OWNER_ONCE_STOP_UNCERTAIN_NO_RETRY');
  process.exitCode=1;
 });
}
