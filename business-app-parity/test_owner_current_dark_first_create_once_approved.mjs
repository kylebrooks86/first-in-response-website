/**
 * FIRE current-source owner DARK first-create one-shot safety checks.
 * No provider authentication, logins, Worker creation, payments or D1 writes.
 * Exact owner-held ZIPs may be passed by env for optional full-byte regression;
 * absent ZIPs are not invented, regenerated or silently treated as passed.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkPackage} from './owner_current_dark_first_create_once_approved.mjs';
const script=fileURLToPath(new URL('./owner_current_dark_first_create_once_approved.mjs',import.meta.url));
let done=0;
const pass=(v,label)=>{assert.ok(v,label);done++;};
const deny=(fn,label)=>{assert.throws(fn,/FIRE ONE-SHOT DARK FIRST-CREATE STOP/,label);done++;};
const run=(mode,target,archive)=>spawnSync(process.execPath,[script,mode,target,archive],{
 encoding:'utf8',env:{...process.env,CI:'true',GITHUB_ACTIONS:'true'}
});
deny(()=>checkPackage('not-a-target','irrelevant.zip'),'invalid environment denied');
for(const target of ['dr','new-live']){
 deny(()=>checkPackage(target,join(tmpdir(),'fire-owner-firstcreate-ABSENT.zip')),
  target+' nonexistent ZIP refused before provider');
 const create=run('create',target,'invalid.zip');
 pass(create.status!==0&&
      /requires interactive owner Acer Windows/.test(create.stderr),
      target+' provider creation refused unconditionally in CI');
}
const unknown=run('inspect','unknown','x.zip');
pass(unknown.status!==0&&/usage:/.test(unknown.stderr),'CLI requires exact target');
const badArgs=spawnSync(process.execPath,[script,'inspect','dr','x.zip','additional'],{
 encoding:'utf8',env:{...process.env,CI:'true'}
});
pass(badArgs.status!==0&&/usage:/.test(badArgs.stderr),'CLI refuses unexpected arguments');
let real=0;
const folder=mkdtempSync(join(tmpdir(),'fire-owner-firstcreate-archive-negative-'));
try{
 for(const [target,key] of [
  ['dr','FIRE_FROZEN_FIRSTCREATE_DR_ZIP'],
  ['new-live','FIRE_FROZEN_FIRSTCREATE_NEW_LIVE_ZIP']
 ]){
  const path=process.env[key];
  if(!path)continue;
  pass(existsSync(path),target+' frozen ZIP path explicitly supplied and exists');
  const reviewed=checkPackage(target,path);
  pass(reviewed.files.size===242,target+' actual original SHA-verified ZIP 242/242');
  const opposite=target==='dr'?'new-live':'dr';
  deny(()=>checkPackage(opposite,path),target+' frozen ZIP cannot cross-target');
  const damaged=Buffer.from(readFileSync(path));
  damaged[120]^=1;
  const altered=join(folder,target+'.zip');
  writeFileSync(altered,damaged);
  deny(()=>checkPackage(target,altered),target+' modified saved archive rejected');
  real++;
 }
}finally{rmSync(folder,{recursive:true,force:true})}
console.log('PASS '+done+'/'+done+' DARK owner first-create CI safety, CLI and no-provider; real owner ZIP sets checked here: '+real+'/2 (run exact ZIP checks only when provided).');
