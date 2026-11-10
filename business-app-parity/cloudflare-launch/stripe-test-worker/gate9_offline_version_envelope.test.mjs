import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateOfflineVersionEnvelope,SYNTHETIC_ASSET_JWT
} from './gate9_offline_version_envelope.mjs';
import {proposedInactivePlan,PREDECESSOR,WORKER} from './gate9_inactive_fullapp_contract.mjs';

const fake=()=>({
  method:'POST',
  path:'/accounts/00000000000000000000000000000000/workers/workers/'+WORKER+'/versions',
  query:{deploy:false},
  body:{
    main_module:'index.js',
    compatibility_date:'2026-11-09',
    compatibility_flags:['nodejs_compat','global_fetch_strictly_public'],
    bindings:proposedInactivePlan().bindings,
    assets:{jwt:SYNTHETIC_ASSET_JWT,config:{run_worker_first:true}},
    modules:[
      {name:'index.js',content_type:'application/javascript+module',
       content_base64:Buffer.from('export default {fetch() {return new Response("synthetic")}}').toString('base64')},
      {name:'ssr/chunk.js',content_type:'application/javascript+module',
       content_base64:Buffer.from('export const testOnly=true').toString('base64')},
      {name:'_headers',content_type:'text/plain',
       content_base64:Buffer.from('/*\n  X-Test-Only: yes').toString('base64')}
    ]
  }
});
const flip=(edit)=>{const v=fake();edit(v);return v;};
test('validates beta POST /versions?deploy=false and complete fake module bytes',()=>{
  const r=validateOfflineVersionEnvelope(fake());
  assert.equal(r.validated,true);
  assert.equal(r.uploaded,false);
  assert.equal(r.versionCreated,false);
  assert.equal(r.gate9Accepted,false);
  assert.equal(r.moduleCount,3);
});
test('refuses wrong worker, missing account pin, deploy query true, alternate endpoints',()=>{
  for(const change of [
    v=>{v.path='/accounts/00000000000000000000000000000000/workers/scripts/'+WORKER+'/versions';},
    v=>{v.path=v.path.replace(WORKER,'LIVE');},
    v=>{v.query.deploy=true;},
    v=>{v.body.deploy=false;},
    v=>{v.query={};},
    v=>{v.method='PUT';}
  ])assert.throws(()=>validateOfflineVersionEnvelope(flip(change)));
});
test('refuses inheritance from latest or arbitrary version, removed secret and R2',()=>{
  for(const change of [
    v=>{v.body.bindings[0].version_id='latest';},
    v=>{v.body.bindings[0].version_id='00000000-0000-4000-8000-000000000000';},
    v=>{v.body.bindings.pop();},
    v=>{v.body.bindings.push({name:'BUCKET',type:'r2_bucket'});},
    v=>{v.body.bindings[0].version_id=PREDECESSOR.toUpperCase();}
  ])assert.throws(()=>validateOfflineVersionEnvelope(flip(change)));
});
test('rejects any real-looking token, JWT substitution, bypass-worker-first, removed assets',()=>{
  for(const change of [
    v=>{v.body.assets.jwt='eyJfake.jwt';},
    v=>{v.body.assets.jwt='sensitive-token';},
    v=>{v.body.assets.config.run_worker_first=false;},
    v=>{delete v.body.assets;},
    v=>{v.body.assets.config.not_found_handling='single-page-application';}
  ])assert.throws(()=>validateOfflineVersionEnvelope(flip(change)));
});
test('rejects missing full worker module, missing _headers and malformed module bodies',()=>{
  for(const change of [
    v=>{v.body.modules=v.body.modules.filter(x=>x.name!=='index.js');},
    v=>{v.body.modules=v.body.modules.filter(x=>x.name!=='_headers');},
    v=>{v.body.modules[1].name='../LIVE/secrets.js';},
    v=>{v.body.modules[1].name='index.js';},
    v=>{v.body.modules[1].content_type='application/json';},
    v=>{v.body.modules[1].content_base64='@@notbase64';},
    v=>{v.body.modules[1].content_base64='YQ===';}
  ])assert.throws(()=>validateOfflineVersionEnvelope(flip(change)));
});
test('accepts compiled server CSS as text module and JSON as json module',()=>{
  const v=fake();
  v.body.modules.push({
    name:'ssr/style.css',content_type:'text/plain',
    content_base64:Buffer.from('body{background:red}').toString('base64')
  },{
    name:'ssr/manifest.json',content_type:'application/json',
    content_base64:Buffer.from('{"synthetic":true}').toString('base64')
  });
  assert.equal(validateOfflineVersionEnvelope(v).moduleCount,5);
});

test('accepts real Vite framework~ chunk naming but not path traversal',()=>{
 const p=fake();
 p.body.modules[1].name='_next/static/framework~index~app-page-cache-A1b2.js';
 assert.equal(validateOfflineVersionEnvelope(p).validated,true);
 p.body.modules[1].name='_next/static/../secrets.js';
 assert.throws(()=>validateOfflineVersionEnvelope(p));
});
