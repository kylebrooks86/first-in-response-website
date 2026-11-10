import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createLocalAssetManifest,safeLocalManifestSummary,inspectSpecialWorkerModules}
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
  writeFileSync(join(x.folder,'.assetsignore'),'/_next/static/chunks/private-build-control');
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
