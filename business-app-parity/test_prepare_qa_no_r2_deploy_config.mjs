import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,readdirSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomUUID} from "node:crypto";
import {prepareNoR2} from "./prepare_qa_no_r2_deploy_config.mjs";
const base=mkdtempSync(join(tmpdir(),"fire-existing-qa-no-r2-"));
const folder=join(base,"dist","server");
mkdirSync(folder,{recursive:true});
const original=join(folder,"wrangler.json");
const destination=()=>join(folder,"wrangler.fire-qa-no-r2-"+randomUUID()+".json");
const fixture=()=>({
 name:"fire-fullapp-qa-20261016",main:"./index.js",legacy_env:true,
 workers_dev:true,compatibility_date:"2026-10-16",
 d1_databases:[{binding:"DB",database_name:"fire-fullapp-qa-db-20261016",
 database_id:"8ccfb1f8-1657-4074-b1b2-47de78f95003"}],
 r2_buckets:[{binding:"BUCKET",bucket_name:"fire-fullapp-qa-photos-20261023"}],
 vars:{FIRE_ENV:"synthetic-qa",FIRE_QA_SYNTHETIC_ONLY:"enabled",
 FIRE_LOCAL_CUSTOMERS_CANDIDATE:"synthetic-only",
 SITE_ORIGIN:"https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev"},
 secrets:{required:["FIRE_QA_PASSWORD_HASH","FIRE_QA_SESSION_SECRET"]},
 assets:{directory:"../client",binding:"ASSETS"}
});
let checks=0;
const test=(title,fn)=>{fn();checks++;console.log("PASS: "+title)};
const source=o=>writeFileSync(original,JSON.stringify(o));
const checkNoTemps=()=>assert.deepEqual(readdirSync(folder).filter(x=>x.startsWith("wrangler.fire-qa-firstpublish-")),[]);
try{
 test("Only the QA Worker/DB/auth/assets and explicit NO-R2 are retained",()=>{
  const before=fixture();source(before);const d=destination();
  const result=prepareNoR2(original,d);
  const actual=JSON.parse(readFileSync(d,"utf8"));
  assert.equal(result.noR2,true);
  const expected={...before};delete expected.legacy_env;delete expected.r2_buckets;
  assert.deepEqual(actual,expected);
  assert.ok(!Object.hasOwn(actual,"r2_buckets"));
  assert.equal(readFileSync(original,"utf8"),JSON.stringify(before));
  checkNoTemps();
 });
 test("No-R2 opt-in cannot overwrite an existing reviewed manifest",()=>{
  source(fixture());const d=destination();writeFileSync(d,"existing");
  assert.throws(()=>prepareNoR2(original,d),/Existing destination/);
  assert.equal(readFileSync(d,"utf8"),"existing");checkNoTemps();
 });
 test("Missing, wrong or existing production R2 SOURCE is refused, never silently accepted",()=>{
  for(const edit of [
   o=>delete o.r2_buckets,
   o=>o.r2_buckets=[],
   o=>o.r2_buckets[0].binding="OTHER",
   o=>o.r2_buckets[0].bucket_name="fire-live-customer-photos",
   o=>o.r2_buckets.push({binding:"BUCKET2",bucket_name:"other"})
  ]){
   const o=fixture();edit(o);source(o);const d=destination();
   assert.throws(()=>prepareNoR2(original,d));assert.throws(()=>readFileSync(d));checkNoTemps();
  }
 });
 test("Cannot target staging/live Worker, wrong D1 or surprise external resources",()=>{
  for(const edit of [
   o=>o.name="fire-app-staging",
   o=>o.d1_databases[0].database_name="fire-app-staging-db",
   o=>o.d1_databases[0].database_id="afb2c05a-d794-4a9a-b580-924ce01c26ad",
   o=>o.workers_dev=false,
   o=>o.routes=["example.com/*"],
   o=>o.kv_namespaces=[{binding:"CACHE",id:"some"}],
   o=>o.secrets.required=[],
   o=>o.vars.FIRE_QA_SYNTHETIC_ONLY="disabled",
   o=>o.vars.SITE_ORIGIN="https://another.workers.dev",
   o=>o.legacy_env=false
  ]){
   const o=fixture();edit(o);source(o);const d=destination();
   assert.throws(()=>prepareNoR2(original,d));assert.throws(()=>readFileSync(d));checkNoTemps();
  }
 });
 test("Relative or nonunique output is refused without touching source",()=>{
  source(fixture());
  assert.throws(()=>prepareNoR2(original,join(base,"elsewhere","wrangler.fire-qa-no-r2-"+randomUUID()+".json")),/preserve original compiled asset paths/);
  assert.throws(()=>prepareNoR2(original,join(folder,"wrangler.json")));
  checkNoTemps();
 });
 console.log("PASS "+checks+" NO-R2 strict manifest regression suites; zero cloud requests, secrets or writes");
} finally {rmSync(base,{recursive:true,force:true});}
