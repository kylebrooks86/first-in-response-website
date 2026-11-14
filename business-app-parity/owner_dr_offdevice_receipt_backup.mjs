/**
 * FIRE owner Acer OFFLINE ONLY: encrypt, verify, or privately restore already
 * accepted physical DR migration and inert Worker receipt evidence.
 * NO Cloudflare, Worker deploy, SQL execution, Stripe, R2, paid cloud, login.
 *
 * node business-app-parity/owner_dr_offdevice_receipt_backup.mjs backup NEW.firedrproof
 * node business-app-parity/owner_dr_offdevice_receipt_backup.mjs verify EXISTING.firedrproof
 * node business-app-parity/owner_dr_offdevice_receipt_backup.mjs restore EXISTING.firedrproof NEW_EMPTY_FOLDER
 *
 * Private passphrase is prompted without echo. NEVER pass as a CLI parameter.
 */
import {existsSync,lstatSync,readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifySavedIndependentD1MigrationWorkspace}
 from './verify_saved_independent_d1_migration_workspace.mjs';
import {encryptDREvidenceEntries,decryptDREvidenceArchive}
 from './protected_dr_evidence.mjs';

const original=join(homedir(),'FIRE-DR-APPROVED-MIGRATION-20261113');
const reviewed=join(homedir(),'FIRE-DR-INERT-REVIEW-be2166c');
const STOP=msg=>{throw Error('FIRE DR off-device backup BLOCKED: '+msg);};
const verifiedFile=file=>{
 if(!existsSync(file))STOP('required accepted owner Acer evidence missing: '+file);
 const meta=lstatSync(file);
 if(meta.isSymbolicLink()||!meta.isFile())STOP('unexpected link or non-file evidence: '+file);
 if(meta.size<1||meta.size>1024*1024)STOP('invalid evidence file size: '+file);
 return readFileSync(file);
};
const ensureRealDir=folder=>{
 if(!existsSync(folder)||!lstatSync(folder).isDirectory()||lstatSync(folder).isSymbolicLink())
  STOP('required existing ordinary folder missing: '+folder);
};
export function collectAcceptedOwnerDRFiles({owner=original,postinstall=reviewed}={}){
 ensureRealDir(owner);ensureRealDir(postinstall);
 const workspace=join(owner,'pinned-26-migrations-canonical-v2');
 // Local read-only check against immutable, reviewed SQL. No new provider
 // checks or re-execution of accepted 26 Cloudflare migrations.
 const result=verifySavedIndependentD1MigrationWorkspace('independent-dr',workspace);
 if(result.savedWorkspaceVerified!==true||result.reviewedSqlFiles!==26)
  STOP('original saved 26 source files are not identical to reviewed DR');
 const entries=[
  {path:'owner/remote-one-shot-attempt.json',bytes:verifiedFile(join(owner,'remote-one-shot-attempt.json'))},
  {path:'owner/dr-physical-schema-receipt.json',bytes:verifiedFile(join(owner,'dr-physical-schema-receipt.json'))},
  {path:'review/dr-compiled-physical-postinstall-reviewed.json',
   bytes:verifiedFile(join(postinstall,'dr-compiled-physical-postinstall-reviewed.json'))}
 ];
 for(const name of ['READ_ME_FIRST.txt','wrangler.json','source-hashes.json'])
  entries.push({path:'workspace/'+name,bytes:verifiedFile(join(workspace,name))});
 const names=readdirSync(join(workspace,'migrations')).sort();
 if(names.length!==26)STOP('not exactly the reviewed 26 migration files');
 for(const name of names){
  if(!/^\d{4}_[a-z0-9_]+\.sql$/.test(name))STOP('unreviewed SQL path');
  entries.push({path:'workspace/migrations/'+name,
    bytes:verifiedFile(join(workspace,'migrations',name))});
 }
 return entries;
}
function maskedPhrase(label){
 if(!process.stdin.isTTY||typeof process.stdin.setRawMode!=='function')
  STOP('use an interactive owner PowerShell terminal; password is never passed in args');
 return new Promise((resolve,reject)=>{
  const bytes=[];
  process.stdout.write(label);
  const done=error=>{
   process.stdin.off('data',onData);
   process.stdin.setRawMode(false);process.stdin.pause();
   process.stdout.write('\n');
   if(error)reject(error);else resolve(Buffer.from(bytes).toString('utf8'));
  };
  const onData=data=>{
   for(const b of data){
    if(b===3||b===4){done(new Error('Owner cancelled; no backup change'));return;}
    if(b===13||b===10){done();return;}
    if(b===8||b===127){bytes.pop();continue;}
    if(b>=32&&bytes.length<4096)bytes.push(b);
   }
  };
  process.stdin.setRawMode(true);
  process.stdin.resume();process.stdin.on('data',onData);
 });
}
function requireNewPath(path){
 if(typeof path!=='string'||!path.trim())STOP('explicit output path required');
 const resolved=resolve(path);
 if(existsSync(resolved))STOP('output already exists; never overwrite previous backup or accepted receipts');
 ensureRealDir(dirname(resolved));
 return resolved;
}
export function restoreArchiveToNewFolder(archive,phrase,output){
 const out=requireNewPath(output);
 const files=decryptDREvidenceArchive(archive,phrase); // Authenticate all data BEFORE ANY file writes
 mkdirSync(out,{mode:0o700});
 for(const {path,bytes} of files){
  const parts=path.split('/'),parent=resolve(out,...parts.slice(0,-1));
  if(!parent.startsWith(out+sep))STOP('restoration path escaped owner folder');
  mkdirSync(parent,{recursive:true,mode:0o700});
  writeFileSync(resolve(out,...parts),bytes,{flag:'wx',mode:0o600});
 }
 return {restored:files.length,folder:out,remoteOperationAttempted:false};
}
async function main(){
 const [mode,path,additional]=process.argv.slice(2);
 if(!['backup','verify','restore'].includes(mode)||typeof path!=='string'||
    (mode==='restore'?!additional:additional!==undefined))
  STOP('usage: backup NEW_FILE.firedrproof | verify EXISTING_FILE.firedrproof | restore EXISTING_FILE.firedrproof NEW_EMPTY_FOLDER');
 const file=resolve(path);
 if(mode==='backup'){
  if(!file.endsWith('.firedrproof'))STOP('encrypted owner backup must use .firedrproof extension');
  requireNewPath(file);
  const contents=collectAcceptedOwnerDRFiles();
  const phrase=await maskedPhrase('Private DR recovery passphrase (input hidden): ');
  const second=await maskedPhrase('Confirm private DR recovery passphrase: ');
  if(phrase!==second)STOP('passphrase confirmation mismatch; nothing saved');
  const ciphertext=encryptDREvidenceEntries(contents,phrase);
  writeFileSync(file,ciphertext,{flag:'wx',mode:0o600});
  const recovered=decryptDREvidenceArchive(readFileSync(file),phrase);
  if(recovered.length!==32)STOP('saved encrypted backup did not reopen to 32 files');
  console.log('FIRE DR PRIVATE EVIDENCE BACKUP: 32/32 FILES ENCRYPTED, SAVED AND REOPENED.');
  console.log('Upload ONLY this .firedrproof file to the existing PRIVATE Google Drive FIRE Business App Backups folder.');
  console.log('No Cloudflare, D1, Stripe, Worker deployment, receipt overwrite or paid subscription.');
 }else{
  const ciphertext=verifiedFile(file);
  const phrase=await maskedPhrase('Private DR recovery passphrase (input hidden): ');
  if(mode==='verify'){
   const contents=decryptDREvidenceArchive(ciphertext,phrase);
   console.log('FIRE DR PRIVATE EVIDENCE BACKUP VERIFIED: '+contents.length+'/32 files, all bytes intact; no restore or provider calls.');
  }else{
   const result=restoreArchiveToNewFolder(ciphertext,phrase,additional);
   console.log('FIRE DR EVIDENCE RESTORED TO NEW PRIVATE FOLDER: '+result.restored+'/32 files; NO provider calls.');
   console.log('Restored JSON/SQL is plaintext; keep that private folder protected.');
  }
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}catch(e){console.error(String(e.message));process.exitCode=1;}
}
