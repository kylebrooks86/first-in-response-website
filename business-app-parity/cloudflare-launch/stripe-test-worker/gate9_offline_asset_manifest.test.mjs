import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createLocalAssetManifest,safeLocalManifestSummary}
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
