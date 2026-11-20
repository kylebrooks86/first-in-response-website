import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyPredecessor, verifyAssetManifest, verifyInactiveProposal,
  proposedInactivePlan, INHERITED, PREDECESSOR, DB_UUID, ORIGIN
} from './gate9_inactive_fullapp_contract.mjs';

// All data is synthetic. No Cloudflare, Stripe, D1, credentials, JWT or network.
const predecessor=()=>({
  id:PREDECESSOR,
  resources:{
    script:{}, script_runtime:{},
    bindings:[
      {name:'DB',type:'d1',id:DB_UUID},
      {name:'FIRE_ACCESS_AUD',type:'secret_text'},
      {name:'FIRE_ACCESS_OWNER_EMAIL',type:'secret_text'},
      {name:'FIRE_ACCESS_TEAM_DOMAIN',type:'secret_text'},
      {name:'STRIPE_WEBHOOK_SECRET',type:'secret_text'},
      {name:'FIRE_ENV',type:'plain_text',text:'cloudflare-staging'},
      {name:'FIRE_ACCESS_REQUIRED',type:'plain_text',text:'enabled'},
      {name:'FIRE_STRIPE_MODE',type:'plain_text',text:'disabled'},
      {name:'SITE_ORIGIN',type:'plain_text',text:ORIGIN}
    ]
  }
});
const manifest=()=>({
  '/_next/static/chunks/app-123.js':{hash:'a'.repeat(32),size:123},
  '/_next/static/css/app-456.css':{hash:'b'.repeat(32),size:456}
});
const mutate = (fn) => {const v=structuredClone(predecessor());fn(v);return v;};
test('validates only exact immutable code-only TEST predecessor metadata',()=>{
  assert.equal(verifyPredecessor(predecessor()),true);
});
test('rejects changed D1, Stripe mode, owner Access settings or origin',()=>{
  const cases=[
    v=>{v.resources.bindings[0].id='00000000-0000-4000-8000-000000000000';},
    v=>{v.resources.bindings.find(x=>x.name==='FIRE_STRIPE_MODE').text='test';},
    v=>{v.resources.bindings.find(x=>x.name==='FIRE_ACCESS_REQUIRED').text='disabled';},
    v=>{v.resources.bindings.find(x=>x.name==='SITE_ORIGIN').text='https://wrong.invalid';}
  ];
  for(const change of cases)assert.throws(()=>verifyPredecessor(mutate(change)));
});
test('rejects secret value disclosure, missing secret, added secret and R2',()=>{
  const cases=[
    v=>{v.resources.bindings.find(x=>x.name==='STRIPE_WEBHOOK_SECRET').text='secret';},
    v=>{v.resources.bindings.find(x=>x.name==='FIRE_ACCESS_AUD').value='sensitive';},
    v=>{v.resources.bindings=v.resources.bindings.filter(x=>x.name!=='STRIPE_WEBHOOK_SECRET');},
    v=>{v.resources.bindings.push({name:'FIRE_EXTRA',type:'secret_text'});},
    v=>{v.resources.bindings.push({name:'BUCKET',type:'r2_bucket'});}
  ];
  for(const change of cases)assert.throws(()=>verifyPredecessor(mutate(change)));
});
test('rejects mistaken predecessor or preexisting static assets baseline',()=>{
  assert.throws(()=>verifyPredecessor(mutate(v=>{v.id='00000000-0000-4000-8000-000000000000';})));
  assert.throws(()=>verifyPredecessor(mutate(v=>{v.resources.assets={};})));
});
test('accepts only local metadata-only compiled JS+CSS manifest',()=>{
  assert.deepEqual(verifyAssetManifest(manifest()),{assetCount:2,assetBytes:579});
  for(const path of [
    '/../.env', '/_next/static/../SECRET', '/.env',
    '/_next/static/file.map', '/_next//static/a.js'
  ]){
    const bad=manifest();bad[path]={hash:'a'.repeat(32),size:1};
    assert.throws(()=>verifyAssetManifest(bad));
  }
});
test('rejects missing real CSS/JS, malformed hash and excessive size',()=>{
  const noCSS=manifest();delete noCSS['/_next/static/css/app-456.css'];
  assert.throws(()=>verifyAssetManifest(noCSS));
  const invalid=manifest();invalid['/_next/static/chunks/app-123.js'].hash='not-a-valid-hash';
  assert.throws(()=>verifyAssetManifest(invalid));
  const large=manifest();large['/_next/static/chunks/app-123.js'].size=30_000_000;
  assert.throws(()=>verifyAssetManifest(large));
});
test('validates only inactive beta Workers version proposal pinned to the serving predecessor',()=>{
  const p=proposedInactivePlan();
  assert.equal(p.bindings.length, INHERITED.length+1);
  assert.deepEqual(verifyInactiveProposal(p),{
    offlineShapeReviewed:true,inactiveOnly:true,exactPredecessorPinned:true,
    actualProviderResponseVerified:false,assetCompletionTokenVerified:false,
    completeCompiledAppVerified:false,uploadAuthorized:false,
    trafficActivationAuthorized:false,gate9Accepted:false
  });
});
test('rejects accidental deployment, API script upload or inherited latest',()=>{
  const cases=[
    p=>{p.deploy=true;},
    p=>{p.api='workers.scripts.versions.create';},
    p=>{p.bindings[0].version_id='latest';},
    p=>{p.bindings[0].version_id='00000000-0000-4000-8000-000000000000';},
    p=>{delete p.bindings[0].version_id;},
  ];
  for(const change of cases){
    const p=proposedInactivePlan();change(p);
    assert.throws(()=>verifyInactiveProposal(p));
  }
});
test('refuses missing/duplicate secrets, D1 or unexpected R2 and payload extras',()=>{
  const cases=[
    p=>{p.bindings=p.bindings.filter(x=>x.name!=='DB');},
    p=>{p.bindings[0]={...p.bindings[1]};},
    p=>{p.bindings.push({name:'BUCKET',type:'r2_bucket'});},
    p=>{p.bindings.find(x=>x.name==='ASSETS').type='inherit';},
    p=>{p.assets={jwt:'DO_NOT_USE'};},
    p=>{p.bindings[0].old_name='LIVE_DB';}
  ];
  for(const change of cases){
    const p=proposedInactivePlan();change(p);
    assert.throws(()=>verifyInactiveProposal(p));
  }
});
