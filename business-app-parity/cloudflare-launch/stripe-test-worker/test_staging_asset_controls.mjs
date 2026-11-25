/** Local-only narrow regression for the approved Vinext routing control. */
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync,linkSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validateStagingAssetControls} from './prepare_staging_noassets_dark_source.mjs';
import {serveBundledAsset} from '../../dr_noassets_runtime.mjs';
const source=process.argv[2];
if(!source||process.argv.length!==3)throw Error('usage: ACTUAL_COMPILED_CLIENT_FOLDER');
const approved=readFileSync(join(source,'_headers'));
assert.equal(createHash('sha256').update(approved).digest('hex'),'2148fb62669525f5091532d36d4a48a8da95b08a5a797bacde75d2fe981351bb');
const root=mkdtempSync(join(tmpdir(),'fire-staging-controls-'));
let checks=1;
try {
 const fixture=(name)=>{const p=join(root,name);mkdirSync(p);return p;};
 const empty=fixture('empty');assert.doesNotThrow(()=>validateStagingAssetControls(empty));checks++;
 const exact=fixture('exact');writeFileSync(join(exact,'_headers'),approved);assert.doesNotThrow(()=>validateStagingAssetControls(exact));checks++;
 const reject=(name,make,pattern)=>{const p=fixture(name);make(p);assert.throws(()=>validateStagingAssetControls(p),pattern);checks++;};
 reject('changed',p=>writeFileSync(join(p,'_headers'),Buffer.concat([approved,Buffer.from('\n# changed\n')])),/unreviewed header bytes/);
 reject('private-cache',p=>writeFileSync(join(p,'_headers'),'/*\n  Cache-Control: public\n'),/unreviewed header bytes/);
 reject('redirect',p=>writeFileSync(join(p,'_redirects'),'/a /b 302'),/redirects require separate review/);
 reject('empty-redirect',p=>writeFileSync(join(p,'_redirects'),''),/redirects require separate review/);
 reject('redirect-case',p=>writeFileSync(join(p,'_REDIRECTS'),''),/redirects require separate review/);
 reject('header-case',p=>writeFileSync(join(p,'_HEADERS'),approved),/unreviewed header filename/);
 reject('header-directory',p=>mkdirSync(join(p,'_headers')),/unreviewed header file shape/);
 reject('oversized',p=>writeFileSync(join(p,'_headers'),Buffer.alloc(1025)),/unreviewed header file shape/);
 reject('hardlink',p=>{writeFileSync(join(p,'original'),approved);linkSync(join(p,'original'),join(p,'_headers'));},/unreviewed header file shape/);
 const data=new Uint8Array([1,2,3]);
 const manifest={'/_next/static/chunks/demo.js':{data,type:'text/javascript'},'/fire-offline/app.js':{data,type:'text/javascript'}};
 for(const method of ['GET','HEAD']){
  const response=serveBundledAsset(new Request('https://example.invalid/_next/static/chunks/demo.js',{method}),manifest);
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'public, max-age=31536000, immutable');checks++;
 }
 assert.equal(serveBundledAsset(new Request('https://example.invalid/fire-offline/app.js'),manifest).headers.get('Cache-Control'),'private, max-age=0, must-revalidate');checks++;
 console.log('PASS '+checks+'/'+checks+' STAGING routing-control and cache-policy checks; zero provider calls.');
}finally{rmSync(root,{recursive:true,force:true});}
