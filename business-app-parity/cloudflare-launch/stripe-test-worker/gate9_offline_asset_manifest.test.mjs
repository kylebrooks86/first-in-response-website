import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createLocalAssetManifest,safeLocalManifestSummary,inspectSpecialWorkerModules,inspectAssetIgnoreControl}
  from './gate9_offline_asset_manifest.mjs';

function fresh() {
 const temporary=mkdtempSync(join(tmpdir(),'FIRE-GATE9-SYNTHETIC-'));
 const folder=join(temporary,'dist','client');
 mkdirSync(join(folder,'_next','static','chunks'),{recursive:true});
 mkdirSync(join(folder,'_next','static','css'),{recursive:true});
 writeFileSync(join(folder,'_next','static','chunks','app.js'),'SYNTHETIC_ONLY_APP');
 writeFileSync(join(folder,'_next','static','css','style.css'),'body{color:red}');
 return {temporary,folder};
}
test('calculates documented Cloudflare hash from synthetic local JS/CSS, never uploads',()=>{
 const x=fresh();
 try {
  const m=createLocalAssetManifest(x.folder);
  assert.equal(Object.keys(m).length,2);
  assert.equal(m['/_next/static/chunks/app.js'].hash,
    createHash('sha256').update(Buffer.from('SYNTHETIC_ONLY_APP').toString('base64')+'js')
      .digest('hex').slice(0,32));
  assert.equal(safeLocalManifestSummary(m).assetsUploaded,false);
  assert.equal(safeLocalManifestSummary(m).gate9Accepted,false);
 }finally{rmSync(x.temporary,{recursive:true,force:true})}
});
test('refuses source trees rather than compiled dist/client folder',()=>{
 const x=fresh();
 try {assert.throws(()=>createLocalAssetManifest(x.temporary));}
 finally{rmSync(x.temporary,{recursive:true,force:true})}
});
test('refuses source maps, credential-like files and missing CSS',()=>{
 const x=fresh();
 try{
  writeFileSync(join(x.folder,'_next','static','chunks','app.js.map'),'{}');
  assert.throws(()=>createLocalAssetManifest(x.folder));
 }finally{rmSync(x.temporary,{recursive:true,force:true})}
 const y=fresh();
 try{
  rmSync(join(y.folder,'_next','static','css'),{recursive:true});
  assert.throws(()=>createLocalAssetManifest(y.folder));
 }finally{rmSync(y.temporary,{recursive:true,force:true})}
});
test('refuses symlink files and noncompiled root symlinks',()=>{
 const x=fresh();
 try {
  symlinkSync(join(x.folder,'_next','static','chunks','app.js'),
    join(x.folder,'_next','static','chunks','copy.js'));
  assert.throws(()=>createLocalAssetManifest(x.folder));
 }finally{rmSync(x.temporary,{recursive:true,force:true})}
});

test('skips Vite private build metadata but rejects other hidden files',()=>{
 const x=fresh();
 try {
  mkdirSync(join(x.folder,'.vite'));
  writeFileSync(join(x.folder,'.vite','manifest.json'),'{"private":true}');
  writeFileSync(join(x.folder,'.assetsignore'),'/.vite/**\n**/*.map\n/_headers\n');
  assert.equal(inspectAssetIgnoreControl(x.folder).ruleCount,3);
  assert.equal(Object.keys(createLocalAssetManifest(x.folder)).length,2);
  writeFileSync(join(x.folder,'.env'),'DO_NOT_UPLOAD');
  assert.throws(()=>createLocalAssetManifest(x.folder));
 }finally{rmSync(x.temporary,{recursive:true,force:true})}
});

test('tracks root _headers/_redirects as distinct text modules, not asset upload bytes',()=>{
 const x=fresh();
 try {
  writeFileSync(join(x.folder,'_headers'),'/_next/static/*\n  Cache-Control: public, max-age=3600\n');
  writeFileSync(join(x.folder,'_redirects'),' /old /new 301\n');
  const manifest=createLocalAssetManifest(x.folder);
  assert.equal(Object.keys(manifest).length,2);
  assert.deepEqual(inspectSpecialWorkerModules(x.folder).map(x=>[x.name,x.contentType]),[
    ['_headers','text/plain'],['_redirects','text/plain']
  ]);
  assert.equal(inspectSpecialWorkerModules(x.folder)[0].sha256.length,64);
 }finally {rmSync(x.temporary,{recursive:true,force:true})}
});
test('refuses secret values in special Worker text modules',()=>{
 const x=fresh();
 try {
  writeFileSync(join(x.folder,'_headers'),'Authorization: whsec_example');
  assert.throws(()=>inspectSpecialWorkerModules(x.folder));
 }finally {rmSync(x.temporary,{recursive:true,force:true})}
});

test('permits ordinary private-labelled chunk but rejects actual token-shaped bytes',()=>{
 const x=fresh();
 try{
  writeFileSync(join(x.folder,'_next','static','chunks','private-app.js'),'console.log("no credentials")');
  assert.equal(Object.keys(createLocalAssetManifest(x.folder)).length,3);
  writeFileSync(join(x.folder,'_next','static','chunks','private-app.js'),
    'const unsafe = "whsec_'+'A'.repeat(28)+'";');
  assert.throws(()=>createLocalAssetManifest(x.folder));
 }finally{rmSync(x.temporary,{recursive:true,force:true})}
});

test('asset manifest insertion order is identical despite opposite filesystem creation order',()=>{
 const a=fresh(),b=fresh();
 try {
  const aa=join(a.folder,'_next','static','chunks');
  const bb=join(b.folder,'_next','static','chunks');
  writeFileSync(join(aa,'z-last.js'),'test-last');
  writeFileSync(join(aa,'A-first.js'),'test-first');
  writeFileSync(join(bb,'A-first.js'),'test-first');
  writeFileSync(join(bb,'z-last.js'),'test-last');
  const ma=createLocalAssetManifest(a.folder);
  const mb=createLocalAssetManifest(b.folder);
  assert.equal(JSON.stringify(ma),JSON.stringify(mb));
  assert.deepEqual(Object.keys(ma),Object.keys(ma).slice().sort());
 } finally {
  rmSync(a.temporary,{recursive:true,force:true});
  rmSync(b.temporary,{recursive:true,force:true});
 }
});


test('rejects wildcard asset ignore that would silently drop critical QA/STAGING client bundles',()=>{
 for(const rule of ['**/*','*','/_next/**','/_next/static/*',
   '/_next/static/chunks/app.js','/**/*.js','*.css','!.vite/**',
   '/public/*','../secrets','.env','/_redirects\n/_next/**']){
  const x=fresh();
  try {
   writeFileSync(join(x.folder,'.assetsignore'),rule+'\n');
   assert.throws(()=>createLocalAssetManifest(x.folder),
     /UNREVIEWED_ASSET_IGNORE_RULE/,'unreviewed rule must stop '+rule);
  }finally{rmSync(x.temporary,{recursive:true,force:true})}
 }
});

test('rejects malformed asset ignore bytes, links and very long build exclusion rules',()=>{
 const x=fresh();
 try{
  const file=join(x.folder,'.assetsignore');
  writeFileSync(file,Buffer.from([0,65,66]));
  assert.throws(()=>createLocalAssetManifest(x.folder),/ASSET_IGNORE_CONTROL_BYTES/);
  writeFileSync(file,'/.vite/**\n'.repeat(1024));
  assert.throws(()=>createLocalAssetManifest(x.folder),/ASSET_IGNORE_CONTROL_SHAPE/);
  rmSync(file);
  symlinkSync(join(x.folder,'_next','static','chunks','app.js'),file);
  assert.throws(()=>createLocalAssetManifest(x.folder),/ASSET_IGNORE_CONTROL_SHAPE/);
 }finally{rmSync(x.temporary,{recursive:true,force:true})}
});

test('safe ignored private controls are SHA256-attested but cannot hide compiled JS/CSS',()=>{
 const x=fresh();
 try{
  const file=join(x.folder,'.assetsignore');
  writeFileSync(file,'# Vite private build controls\n/.vite/**\n/_headers\n/_redirects\n**/*.map\n');
  const meta=inspectAssetIgnoreControl(x.folder);
  assert.equal(meta.present,true);
  assert.equal(meta.ruleCount,4);
  assert.match(meta.sha256,/^[a-f0-9]{64}$/);
  assert.equal(Object.keys(createLocalAssetManifest(x.folder)).length,2);
  assert.equal(safeLocalManifestSummary(createLocalAssetManifest(x.folder)).assetsUploaded,false);
 }finally{rmSync(x.temporary,{recursive:true,force:true})}
});
