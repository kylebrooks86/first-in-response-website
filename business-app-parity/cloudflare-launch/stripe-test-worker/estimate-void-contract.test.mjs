import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const text=(path)=>readFileSync(fileURLToPath(new URL(path,import.meta.url)),'utf8');
const route=text('../../shared/app/api/estimates/[id]/void/route.ts');
const owner=text('../../shared/app/dashboard.tsx');
const customer=text('../../shared/app/estimate/[token]/page.tsx');
const accept=text('../../shared/app/api/public/estimates/[token]/accept/route.ts');

test('void is owner-only and never deletes customer/estimate/financial rows',()=>{
  assert.match(route,/getChatGPTUser\(\)/);
  assert.match(route,/OWNER_EMAIL/);
  assert.match(route,/status='declined'/);
  assert.doesNotMatch(route,/DELETE\s+FROM/i);
  assert.doesNotMatch(route,/stripe|refund\(/i);
});

test('conditional update protects signed, scheduled and all financial dependencies',()=>{
  for(const phrase of [
    "status IN ('draft','sent')",
    "accepted_at IS NULL",
    "signed_at IS NULL",
    "scheduled_at IS NULL",
    'NOT EXISTS (SELECT 1 FROM invoices WHERE estimate_id=?)',
    'NOT EXISTS (SELECT 1 FROM payments WHERE estimate_id=?)',
    'NOT EXISTS (SELECT 1 FROM payment_refunds WHERE estimate_id=?)',
    'NOT EXISTS (SELECT 1 FROM payment_checkout_sessions WHERE estimate_id=?)',
    'NOT EXISTS (SELECT 1 FROM job_reports WHERE estimate_id=?)'
  ])assert.ok(route.includes(phrase),`missing transactional guard: ${phrase}`);
  assert.match(route,/update\.meta\.changes !== 1/);
  assert.match(route,/saveUncertain:true/);
});

test('owner UI confirms non-destructive void and blocks stale editor/send/pay controls',()=>{
  assert.match(owner,/Void unaccepted estimate/);
  assert.match(owner,/does NOT permanently delete it/);
  assert.match(owner,/onClick=\{\(\)=>void voidUnaccepted\(\)\}/);
  assert.match(owner,/!\["superseded","declined"\]\.includes\(estimate\.status\)&&<EditEstimateDialog/);
  assert.match(owner,/!\["superseded","declined"\]\.includes\(estimate\.status\)&&<RecordPayment/);
});

test('voided customer page removes signing widget and payment instructions',()=>{
  assert.match(customer,/row\.status==="declined"\?<p className="pay-note"/);
  assert.match(customer,/Estimate no longer available/);
  assert.match(customer,/!\["superseded","declined"\]\.includes\(row\.status\)/);
  assert.match(accept,/\!\["draft","sent"\]\.includes\(estimate\.status\)/);
});
