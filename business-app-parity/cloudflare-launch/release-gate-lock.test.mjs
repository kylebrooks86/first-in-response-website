import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=(relative)=>readFileSync(new URL(relative,root),'utf8');
const lock=JSON.parse(read('cloudflare-launch/FIRE_PRODUCTION_GATE_LOCK_20261102.json'));

test('FIRE cannot claim production release GO from accepted isolated TEST checks',()=>{
  assert.equal(lock.schemaVersion,1);
  assert.equal(lock.scope,'FIRE Business App only');
  assert.equal(lock.decision,'NO_GO');
  for(const flag of ['productionReleaseAuthorized','productionDeployAllowed',
    'productionSchemaMigrationAllowed','stripeWebhookOrPaymentWritesAllowed'])
    assert.equal(lock[flag],false,flag+' must fail closed until new independently verified release evidence');
  assert.equal(lock.totalProductionGates,10);
  assert.equal(lock.acceptedProductionGates,3);
  assert.deepEqual(lock.gateStatus.map(g=>g.gate),Array.from({length:10},(_,i)=>i+1));
  assert.deepEqual(lock.gateStatus.map(g=>g.status),
    ['accepted','accepted','accepted','blocked','blocked','partial','blocked','blocked','blocked','blocked']);
  assert.equal(lock.gateStatus.filter(g=>g.status==='accepted').length,lock.acceptedProductionGates);
  for(const g of lock.gateStatus)
    assert.ok(g.evidence||g.requires,'Gate '+g.gate+' needs supported evidence or a blocker');
  for(const g of lock.gateStatus.filter(g=>g.status!=='accepted'))
    assert.ok(typeof g.requires==='string'&&g.requires.length>25,'Gate '+g.gate+' cannot silently become release-ready');
});

test('previous source/build and infrastructure inventories remain honestly NOT production-ready',()=>{
  const candidates=JSON.parse(read('CANDIDATE_COMMITS.json'));
  const parity=JSON.parse(read('FIRE_CANDIDATE_PARITY.json'));
  const inventory=JSON.parse(read('FIRE_DEPLOYMENT_INVENTORY.json'));
  assert.equal(candidates.productionReady,false);
  assert.equal(candidates.deployed,false);
  assert.equal(parity.productionReady,false);
  assert.equal(inventory.productionApprovalRequired,true);
  assert.equal(inventory.paidServicesAllowed,false);
  const live=inventory.targets.find(t=>t.name==='LIVE');
  assert.ok(live,'LIVE target must remain explicit and distinct from isolated TEST');
  assert.equal(live.candidateTableComparison.productionReady,false);
  assert.ok(live.candidateTableComparison.missingTables.includes('payment_refunds'),
    'Historical LIVE refund-ledger gap must not be erased without new provider evidence');
});

test('source-only review and accepted TEST path exceptions are not represented as final LIVE state',()=>{
  assert.equal(lock.sourceReviews.integratedDraftPR,84);
  assert.equal(lock.sourceReviews.sourceOnly,true);
  assert.equal(lock.sourceReviews.notMerged,true);
  assert.equal(lock.sourceReviews.notDeployed,true);
  assert.equal(lock.gateStatus[5].status,'partial');
  const readme=read('cloudflare-launch/README_SOURCE_ONLY.md');
  assert.match(readme,/seven.*approved public customer-view\/static-asset Access exceptions/);
  assert.match(readme,/guarded.*CLOSE/);
  assert.match(readme,/does \*\*not\*\* establish full 11-path production customer POST policy/);
  assert.doesNotMatch(readme,/\*\*No public-path overrides have been installed, accepted or verified in Cloudflare\.\*\*/);
});

test('financial provider check and database uncertainty cannot silently vanish',()=>{
  assert.match(lock.gateStatus[3].requires,/LIVE.*D1 UUID/i);
  assert.match(lock.gateStatus[4].requires,/payment_refunds/);
  assert.match(lock.gateStatus[8].requires,/signed webhook\/refund events/);
  assert.match(lock.gateStatus[9].requires,/explicit owner approval/);
});
