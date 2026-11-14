/** Change-only FIRE DR no-assets Worker source tests; zero provider calls. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync,existsSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareNoAssetsDRWorker} from './prepare_dr_noassets_worker.mjs';
import {serveBundledAsset,wrapInertDRWorker,assetContentType} from './dr_noassets_runtime.mjs';

const SHA='a'.repeat(40);
const H=b=>createHash('sha256').update(b).digest('hex');
const original={
 name:'fire-fullapp-dr',workers_dev:true,main:'index.js',no_bundle:true,
 compatibility_date:'2026-11-13',compatibility_flags:['nodejs_compat'],
 assets:{directory:'../client'},
 secrets:{required:['FIRE_DR_PASSWORD_HASH','FIRE_DR_SESSION_SECRET']},
 vars:{FIRE_ENV:'isolated-dr',SITE_ORIGIN:'https://fire-fullapp-dr.kyle-bfc.workers.dev',FIRE_DR_AUTH_ENABLED:'blocked'},
 d1_databases:[{binding:'DB',database_name:'fire-fullapp-dr-db',database_id:'00000000-0000-4000-8000-000000000000'}],
 r2_buckets:[],kv_namespaces:[],services:[],rules:[{type:'ESModule',globs:['**/*.js','**/*.mjs']}]
};
const main=mkdtempSync(join(tmpdir(),'fire-dr-no-assets-workflow-'));let checks=0;
const verify=(condition,label)=>{assert.ok(condition,label);checks++;};
const reject=(fn,label)=>{assert.throws(fn,/BLOCKED/,'Must reject '+label);checks++;};
const files=[
 ['fire-offline/index.html','<!doctype html>FIRE local field\n'],
 ['fire-offline/app.js','export const local=true;\n'],
 ['fire-offline/app.css','body{margin:0}\n'],
 ['_next/static/chunks/app.js','export const app=1;\n'],
 ['_next/static/css/app.css','.page{color:blue}\n'],
 ['favicon.svg','<svg xmlns="http://www.w3.org/2000/svg"/>\n'],
 ['.vite/manifest.json','{"private":true}\n'],
 ['.assetsignore','.vite\n'],['_headers','/_next/static/*\n  Cache-Control: public\n']
];
const make=(name,config=original)=>{
 const root=join(main,name),dist=join(root,'dist'),seal=join(root,'seal.json');
 mkdirSync(join(dist,'server'),{recursive:true});mkdirSync(join(dist,'client'),{recursive:true});
 writeFileSync(join(dist,'server','wrangler.json'),JSON.stringify(config));
 writeFileSync(join(dist,'server','index.js'),
  'export default {fetch(){return new Response("original SSR")}};\n');
 for(const [path,data] of files){
  const p=join(dist,'client',path);mkdirSync(join(p,'..'),{recursive:true});writeFileSync(p,data);
 }
 const inventory=[];
 function scan(path,prefix){
  for(const name of (awaitDir(path))){
   const abs=join(path,name),relative=prefix+name,meta=(awaitStat(abs));
   if(meta.isDirectory())scan(abs,relative+'/');
   else{const body=readFileSync(abs);inventory.push({path:relative,bytes:body.length,sha256:H(body)});}
  }
 }
 // Safe ordinary fixture only; no symlinks before optional adversarial test.
 const fs=requireFs;
 function awaitDir(path){return fs.readdirSync(path).sort()}
 function awaitStat(path){return fs.lstatSync(path)}
 scan(dist,'');
 inventory.sort((a,b)=>a.path.localeCompare(b.path,'en'));
 const json={kind:'FIRE_SOURCE_ONLY_INERT_DR_COMPILED_ARTIFACT_V1',reviewedPullRequest:264,
  reviewedSourceSha:SHA,target:'independent-dr',drWorker:'fire-fullapp-dr',
  physicalDatabaseBindingAttempted:false,ownerAuthenticationEnabled:false,
  cloudflareUploaded:false,cloudflareDeployed:false,stripeActivated:false,
  ownerApprovedDeployment:false,reviewedFileCount:inventory.length,
  filesDigestSha256:H(Buffer.from(JSON.stringify(inventory))),files:inventory};
 writeFileSync(seal,JSON.stringify(json));
 return {root,dist,seal,out:join(root,'alternative')};
};
import * as requireFs from 'node:fs';
try{
 const f=make('good');
 const result=prepareNoAssetsDRWorker(f.dist,f.seal,SHA,f.out);
 verify(result.status==='FIRE_DR_NO_ASSET_UPLOAD_WORKER_CANDIDATE_LOCAL_ONLY',
  'Alternate Worker source candidate produced without Cloudflare');
 verify(result.assetCount===6&&result.providerContacted===false&&result.r2Required===false,
  'Only six public assets and no R2/provider');
 const config=JSON.parse(readFileSync(join(f.out,'server','wrangler.json'),'utf8'));
 verify(config.assets===undefined&&config.main==='fire-noassets-entry.mjs'&&
  config.no_bundle===true&&config.find_additional_modules===true,
  'Real client asset upload configuration removed entirely');
 verify(config.rules.every(r=>r.type!=='Data')&&config.rules.some(r=>r.type==='ESModule'),
  'Wrangler default built-in Data binary rule is not overridden with duplicate rule');
 verify(config.vars.FIRE_DR_AUTH_ENABLED==='blocked'&&config.d1_databases[0].database_id===
  '00000000-0000-4000-8000-000000000000'&&config.r2_buckets.length===0,
  'Owner auth blocked, D1 remains unbound and no paid R2');
 const receipt=JSON.parse(readFileSync(join(f.out,'alternative-receipt.json'),'utf8'));
 verify(receipt.cloudflareAssetsUploadSessionRequired===false&&
  receipt.clientAssets.length===6&&receipt.sourceOnly===true,
  'Correct non-provider alternative provenance and module count');
 verify(receipt.clientAssets.every(x=>
  readFileSync(join(f.out,'server',x.module)).equals(readFileSync(join(f.dist,'client',x.path.slice(1))))&&
  H(readFileSync(join(f.out,'server',x.module)))===x.sha256),
  'Every binary Data module byte-identical to actual compiled client assets');
 const m=readFileSync(join(f.out,'server','fire-inline-assets','manifest.mjs'),'utf8');
 verify((m.match(/import b\d+ from/g)||[]).length===6&&
  !m.includes('.vite/manifest')&&!m.includes('/_headers'),
  'Manifest references all and only public assets');
 verify(readFileSync(join(f.out,'server','index.js')).equals(readFileSync(join(f.dist,'server','index.js'))),
  'Original QA-master SSR Worker kept byte identical');
 const resource=new Uint8Array([1,2,3]).buffer;
 const manifest={'/_next/static/chunks/app.js':{data:resource,type:assetContentType('app.js')},
  '/fire-offline/app.css':{data:resource,type:assetContentType('app.css')}};
 const exact=serveBundledAsset(new Request('https://fire.example/_next/static/chunks/app.js'),manifest);
 verify(exact.status===200&&exact.headers.get('cache-control').includes('immutable')&&
  exact.headers.get('x-content-type-options')==='nosniff',
  'Exact compiled JS asset is served with MIME, cache, nosniff');
 verify((await exact.arrayBuffer()).byteLength===3,'Static bytes are intact');
 const head=serveBundledAsset(new Request('https://fire.example/fire-offline/app.css',{method:'HEAD'}),manifest);
 verify(head.status===200&&head.body===null,'HEAD supported without exposing body');
 const nope=serveBundledAsset(new Request('https://fire.example/_next/static/chunks/missing.js'),manifest);
 verify(nope.status===404,'Missing compiled hashed JS must NOT fall through to HTML');
 const post=serveBundledAsset(new Request('https://fire.example/fire-offline/app.css',{method:'POST'}),manifest);
 verify(post.status===405,'No POST to static field files');
 verify(serveBundledAsset(new Request('https://fire.example/api/customers'),manifest)===null,
  'Application API requests fall through to original SSR');
 let seen=0;
 const wrapped=wrapInertDRWorker({fetch:async(req,env)=>{seen++;
  const inner=await env.ASSETS.fetch(new Request('https://fire.example/fire-offline/app.css'));
  return new Response('SSR '+inner.status+' '+Boolean(env.DB));}},manifest);
 const dynamic=await wrapped.fetch(new Request('https://fire.example/api/customers'),{DB:{}},{});
 verify(dynamic.status===200&&(await dynamic.text())==='SSR 200 true'&&seen===1,
  'Original SSR receives isolated DB and compatible static asset fetcher');
 const bad=await wrapped.fetch(new Request('https://fire.example/api/customers'),{ASSETS:{}},{});
 verify(bad.status===503&&seen===1,'Unexpected Cloudflare assets binding rejected');
 reject(()=>prepareNoAssetsDRWorker(f.dist,f.seal,SHA,f.out),'output overwrite');
 reject(()=>prepareNoAssetsDRWorker(f.dist,f.seal,'b'.repeat(40),join(f.root,'bad-sha')),
  'wrong exact source SHA');
 const changed=make('changed');
 writeFileSync(join(changed.dist,'client','fire-offline','app.js'),'ALTERED');
 reject(()=>prepareNoAssetsDRWorker(changed.dist,changed.seal,SHA,changed.out),
  'modified originally sealed QA-master client bytes');
 const live=make('live',{...original,name:'fire-fullapp-new-live'});
 reject(()=>prepareNoAssetsDRWorker(live.dist,live.seal,SHA,live.out),
  'LIVE worker impersonating DR');
 const auth=make('auth',{...original,vars:{...original.vars,FIRE_DR_AUTH_ENABLED:'owner-approved'}});
 reject(()=>prepareNoAssetsDRWorker(auth.dist,auth.seal,SHA,auth.out),
  'owner auth silently enabled');
 const r2=make('r2',{...original,r2_buckets:[{binding:'PHOTOS',bucket_name:'not-approved'}]});
 reject(()=>prepareNoAssetsDRWorker(r2.dist,r2.seal,SHA,r2.out),
  'unauthorized paid R2 storage');
 const poison=make('symlink');
 symlinkSync(join(poison.dist,'client','fire-offline','app.js'),
  join(poison.dist,'client','fire-offline','linked.js'));
 reject(()=>prepareNoAssetsDRWorker(poison.dist,poison.seal,SHA,poison.out),
  'symbolic link in compiled release');
 console.log('PASS '+checks+'/'+checks+
  ' Worker-only no-asset-upload source generator, byte-for-byte QA assets, offline SSR routing and critical misbinding/overwrite/refusal cases; NO provider calls.');
}finally{rmSync(main,{recursive:true,force:true});}
