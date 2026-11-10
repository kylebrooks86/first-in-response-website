import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {inventoryCompiledModules} from './gate9_offline_server_modules.mjs';
function fresh(){
  const temp=mkdtempSync(join(tmpdir(),'FIRE-GATE9-MODULE-FIXTURE-'));
  const root=join(temp,'dist','server');
  mkdirSync(join(root,'chunks'),{recursive:true});
  writeFileSync(join(root,'index.js'),'export default { fetch(){ return new Response("TEST_ONLY") } };');
  writeFileSync(join(root,'chunks','app.js'),'export const synthetic = true;');
  writeFileSync(join(root,'wrangler.json'),'{"main":"index.js","d1_databases":[{"database_id":"FAKE"}]}');
  return {temp,root};
}
test('hashes exact local synthetic entrypoint and module closure without writes',()=>{
  const x=fresh();
  try {
    const out=inventoryCompiledModules(x.root,'index.js');
    assert.equal(out.moduleCount,2);
    assert.equal(out.mainSha256,createHash('sha256')
      .update('export default { fetch(){ return new Response("TEST_ONLY") } };')
      .digest('hex'));
    assert.equal(out.uploaded,false);
    assert.equal(out.deployed,false);
    assert.equal(out.gate9Accepted,false);
  }finally{rmSync(x.temp,{recursive:true,force:true})}
});
test('rejects missing, path-traversal and non-JavaScript entrypoints',()=>{
  const x=fresh();
  try{
    for(const main of ['../live/index.js','/tmp/key.js','nope.js','wrangler.json','index.js.map']){
      assert.throws(()=>inventoryCompiledModules(x.root,main));
    }
  }finally{rmSync(x.temp,{recursive:true,force:true})}
});
test('rejects symlink modules and unsupported executables',()=>{
  const x=fresh();
  try{
    symlinkSync(join(x.root,'index.js'),join(x.root,'copy.js'));
    assert.throws(()=>inventoryCompiledModules(x.root,'index.js'));
  }finally{rmSync(x.temp,{recursive:true,force:true})}
  const y=fresh();
  try{
    writeFileSync(join(y.root,'secret.env'),'NOT_A_REAL_SECRET');
    assert.throws(()=>inventoryCompiledModules(y.root,'index.js'));
  }finally{rmSync(y.temp,{recursive:true,force:true})}
});
test('never accepts source roots or production/source config locations',()=>{
  const x=fresh();
  try {assert.throws(()=>inventoryCompiledModules(x.temp,'index.js'));}
  finally{rmSync(x.temp,{recursive:true,force:true})}
});
