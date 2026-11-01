import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from './index.mjs';
const cfg=JSON.parse(readFileSync(new URL('./wrangler.json',import.meta.url),'utf8'));
test('exact owner-approved test-only D1, Worker identity and no public routes or previews',()=>{
  assert.equal(cfg.name,'fire-stripe-test-20261101');
  assert.equal(cfg.main,'./index.mjs');
  assert.equal(cfg.workers_dev,false);
  assert.equal(cfg.preview_urls,false);
  assert.deepEqual(cfg.routes,[]);
  assert.equal(cfg.compatibility_date,'2026-11-01');
  assert.deepEqual(cfg.d1_databases,[{binding:'DB',database_name:'fire-stripe-test-db-20261101',database_id:'dba421ba-fc66-4cf8-9c31-51616f8249ba'}]);
  for(const forbidden of ['env','secrets','vars','r2_buckets','kv_namespaces','services','triggers','zone_id','account_id','unsafe','build','assets'])
    assert.equal(Object.hasOwn(cfg,forbidden),false,forbidden);
  assert.notEqual(cfg.d1_databases[0].database_id,'afb2c05a-d794-4a9a-b580-924ce01c26ad');
  assert.notEqual(cfg.d1_databases[0].database_id,'8ccfb1f8-1657-4074-b1b2-47de78f95003');
});
test('stub always fails closed, never responds with customer data',async()=>{
  for(const path of ['/', '/api/payments/checkout','/api/payments/webhook','/api/customers','/estimate/test']){
    const reply=await worker.fetch(new Request('https://example.invalid'+path), {DB:{prepare(){throw Error('DB MUST NOT BE QUERIED')}}});
    assert.equal(reply.status,403,path);
    assert.equal(reply.headers.get('cache-control'),'no-store');
    assert.equal(reply.headers.get('x-content-type-options'),'nosniff');
    assert.match(await reply.text(),/test Worker disabled/);
  }
});
