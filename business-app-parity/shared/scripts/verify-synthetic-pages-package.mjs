// Release-safe Pages asset gate: local files only, no network, deployment,
// customer data, hosting credentials or browser storage involved.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative,sep} from 'node:path';
import {prepareSyntheticPages} from './prepare-local-customer-pages.mjs';
import {buildCustomerDemoAssets,SYNTHETIC_PAGES_ORIGIN} from './local-customer-demo-assets.mjs';
const sha256=body=>createHash('sha256').update(body).digest('hex');
const ALLOWED=new Set([
  '_headers','_redirects','404.html','robots.txt',
  'synthetic-customer-demo/index.html','synthetic-customer-demo/store.js',
  'synthetic-customer-demo/backup.js','synthetic-customer-demo/vault.js',
  'synthetic-customer-demo/demo.js','synthetic-customer-demo/worker.js',
  'synthetic-customer-demo/manifest.webmanifest',
  'synthetic-customer-demo/icon-180.png','synthetic-customer-demo/icon-512.png',
]);
function inventory(folder,root=folder){
 return readdirSync(folder,{withFileTypes:true}).flatMap(entry=>{
   if(entry.isSymbolicLink()||(!entry.isFile()&&!entry.isDirectory()))throw Error('Disallowed package entry');
   const p=join(folder,entry.name);
   return entry.isDirectory()?inventory(p,root):[relative(root,p).split(sep).join('/')];
 }).sort();
}
export function verifyPackage(destination){
 const target=resolve(destination),upload=join(target,'upload');
 const receipt=JSON.parse(readFileSync(join(target,'publication-review.json'),'utf8'));
 assert.equal(receipt.schemaVersion,1);
 assert.equal(receipt.origin,SYNTHETIC_PAGES_ORIGIN);
 assert.equal(receipt.scope,'/synthetic-customer-demo/');
 assert.equal(receipt.project,'fire-synthetic-offline-test-bfc00939');
 assert.equal(receipt.uploadDirectory,'upload');
 assert.equal(receipt.publicationAuthorized,false);
 assert.equal(receipt.realRecordsIncluded,false);
 assert.equal(receipt.staticOnly,true);
 assert.deepEqual(receipt.bindings,[]);
 assert.deepEqual(receipt.functions,[]);
 const names=inventory(upload);
 assert.deepEqual(names,[...ALLOWED].sort(),'Unexpected static or potentially sensitive files');
 assert.equal(receipt.files.length,ALLOWED.size);
 assert.deepEqual(new Set(receipt.files.map(file=>file.file)),ALLOWED);
 const expected=buildCustomerDemoAssets({deploymentOrigin:SYNTHETIC_PAGES_ORIGIN});
 assert.equal(receipt.version,expected.version,'Synthetic build version drift');
 for(const file of receipt.files){
   assert.ok(ALLOWED.has(file.file));
   assert.ok(/^[a-f0-9]{64}$/.test(file.sha256),'Invalid SHA-256 format');
   const data=readFileSync(join(upload,file.file));
   assert.equal(sha256(data),file.sha256,`Tampered static asset: ${file.file}`);
   assert.equal(data.length,file.bytes,`Changed file size: ${file.file}`);
 }
 for(const [key,{body}] of expected.assets){
   const name='synthetic-customer-demo/'+(key.slice(expected.scope.length)||'index.html');
   assert.deepEqual(readFileSync(join(upload,name)),body,`Source-to-package mismatch: ${name}`);
 }
 assert.deepEqual(readFileSync(join(upload,'synthetic-customer-demo/worker.js')),
                  Buffer.from(expected.worker),'Service worker differs from deterministic source');
 const manifest=JSON.parse(readFileSync(join(upload,'synthetic-customer-demo/manifest.webmanifest'),'utf8'));
 assert.equal(manifest.id,expected.scope);
 assert.equal(manifest.scope,expected.scope);
 assert.equal(manifest.start_url,expected.scope);
 assert.equal(manifest.display,'standalone');
 assert.deepEqual(manifest.icons.map(item=>item.sizes),['180x180','512x512']);
 const headers=readFileSync(join(upload,'_headers'),'utf8');
 for(const statement of ['Cache-Control: no-store','X-Content-Type-Options: nosniff',
  'X-Frame-Options: DENY','X-Robots-Tag: noindex, nofollow',
  "Content-Security-Policy: default-src 'none'",
  "connect-src 'self'","frame-ancestors 'none'",
  'Service-Worker-Allowed: /synthetic-customer-demo/']){
   assert.ok(headers.includes(statement),`Missing restrictive static response policy: ${statement}`);
 }
 assert.equal(readFileSync(join(upload,'_redirects'),'utf8'),
              '/ /synthetic-customer-demo/ 302\n');
 const worker=expected.worker;
 assert.ok(worker.includes("request.method === 'GET'")&&worker.includes("url.origin === self.location.origin")
   &&worker.includes('ASSETS.includes(url.pathname)'));
 assert.ok(!worker.includes('skipWaiting('),'Published synthetic worker cannot forcibly replace an active worker');
 const guardedDemo=readFileSync(join(upload,'synthetic-customer-demo/demo.js'),'utf8');
 assert.ok(guardedDemo.includes('location.origin !== '+JSON.stringify(SYNTHETIC_PAGES_ORIGIN)),
           'Exact test origin guard missing');
 assert.ok(!guardedDemo.includes("!['127.0.0.1', 'localhost'].includes(location.hostname)"),
           'Localhost-only guard was not correctly replaced for isolated static Pages origin');
 const textAssets=names.filter(name=>!name.endsWith('.png')).map(name=>readFileSync(join(upload,name),'utf8')).join('\n');
 for(const forbidden of [/https?:\/\/fire-app\.kylebrooks8605\.chatgpt\.site/i,
                         /https?:\/\/fire-live-refund-staging\.kylebrooks8605\.chatgpt\.site/i,
                         /\b(?:sk_live|sk_test|rk_live|rk_test|whsec)_/i,
                         /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/]){
   assert.ok(!forbidden.test(textAssets),`Unsafe hosted endpoint or secret marker in published static files: ${forbidden}`);
 }
 return {
   status:'verified-static-synthetic-only',
   sourceVersion:expected.version,
   files:names.length,
   origin:SYNTHETIC_PAGES_ORIGIN,
   scope:expected.scope,
   assetReceiptSha256:sha256(readFileSync(join(target,'publication-review.json'))),
   publicationAuthorized:false,
   physicalIphoneTested:false,
   hostedArtifactIdentityVerified:false,
   productionAppChanged:false
 };
}
const arg=process.argv[2];
if(import.meta.url===new URL('file://'+resolve(process.argv[1])).href){
 const scratch=arg?null:mkdtempSync(join(tmpdir(),'fire-synthetic-pages-gate-'));
 const dest=arg?resolve(arg):join(scratch,'review');
 try{
   if(!arg)prepareSyntheticPages(dest);
   const result=verifyPackage(dest);
   if(!arg){
     const fake=join(dest,'upload/synthetic-customer-demo/demo.js');
     const original=readFileSync(fake);
     writeFileSync(fake,'tampered synthetic script');
     assert.throws(()=>verifyPackage(dest),/Tampered static asset/);
     writeFileSync(fake,original);
     const r=JSON.parse(readFileSync(join(dest,'publication-review.json'),'utf8'));
     r.publicationAuthorized=true;
     writeFileSync(join(dest,'publication-review.json'),JSON.stringify(r));
     assert.throws(()=>verifyPackage(dest),/true !== false/);
     console.log('PASS: deterministic synthetic Pages assets, strict allowlist, receipt hashes, origin/scope, CSP, no real API/secrets, and two negative tamper/publish tests.');
   }else console.log(JSON.stringify(result,null,2));
 }finally{if(scratch)rmSync(scratch,{recursive:true,force:true});}
}
