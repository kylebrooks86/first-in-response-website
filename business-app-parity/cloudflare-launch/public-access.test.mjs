import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewedPublicAccessOverrides,verifyPublicAccessOverrides,REQUIRED_PUBLIC_ACCESS_PATHS,
  OWNER_ONLY_PATH_SAMPLES,accessPathPatternMatches} from './public-access-contract.mjs';

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('customer links and endpoints are present in existing FIRE source',()=>{
  const dashboard=file('shared/app/dashboard.tsx');
  assert.match(dashboard,/\/estimate\/\$\{shareToken\}/);
  assert.match(dashboard,/\/invoice\/\$\{invoiceShareToken\}/);
  const acceptance=file('shared/app/estimate/[token]/accept-button.tsx');
  assert.match(acceptance,/\/api\/public\/estimates\/\$\{token\}\/accept/);
  assert.match(acceptance,/\/api\/public\/estimates\/\$\{token\}\/change-request/);
  assert.match(file('shared/app/estimate/[token]/revised-deposit-accept-button.tsx'),/revised-accept/);
  assert.match(file('shared/app/pay/[id]/pay-button.tsx'),/\/api\/payments\/checkout/);
  assert.match(file('shared/app/api/payments/checkout/route.ts'),/e\.share_token=\?/);
  for(const path of ['shared/app/estimate/[token]/page.tsx','shared/app/invoice/[token]/page.tsx','shared/app/pay/[id]/page.tsx'])
    assert.match(file(path),/env\.DB/);
});
test('narrow customer exceptions allow public links, NOT private owner routes',()=>{
  const report=verifyPublicAccessOverrides(reviewedPublicAccessOverrides());
  assert.equal(report.status,'CUSTOMER_PATH_POLICY_READY_FOR_PROVIDER_REVIEW');
  for(const flag of ['providerConfigured','customerLinksTested','ownerRoutesVerifiedPrivate','assetsVerified','publicationAuthorized'])
    assert.equal(report[flag],false);
  const examples=[
    '/estimate/123e4567-e89b-12d3-a456-426614174000',
    '/invoice/123e4567-e89b-12d3-a456-426614174000',
    '/pay/123e4567-e89b-12d3-a456-426614174000',
    '/api/public/estimates/123e4567-e89b-12d3-a456-426614174000/accept',
    '/api/public/estimates/123e4567-e89b-12d3-a456-426614174000/change-request',
    '/api/public/estimates/123e4567-e89b-12d3-a456-426614174000/revised-accept',
    '/api/payments/checkout','/fire-app-logo.png','/_next/static/chunks/a.js','/assets/a.css',
  ];
  for(const path of examples)assert.equal(REQUIRED_PUBLIC_ACCESS_PATHS.some(p=>accessPathPatternMatches(p,path)),true,path);
  for(const path of OWNER_ONLY_PATH_SAMPLES)assert.equal(REQUIRED_PUBLIC_ACCESS_PATHS.some(p=>accessPathPatternMatches(p,path)),false,path);
});
test('fail closed on broad bypass, missing route, duplicate, or extra metadata',()=>{
  const changes=[
    x=>x[0].path_pattern='/*',x=>x[0].path_pattern='/api/*',
    x=>x[0].path_pattern='/api/public/*',x=>x[0].path_pattern='/api/payments/*',
    x=>x[0].path_pattern='/_next/*',x=>x[0].path_pattern='/estimate/',
    x=>x.pop(),x=>x[0].behavior='bypass',x=>x[0].reason='everyone',
    x=>x[1].path_pattern=x[0].path_pattern,
    x=>x.push({behavior:'public',path_pattern:'/api/backup'}),
  ];
  for(const mutate of changes){
    const x=reviewedPublicAccessOverrides();mutate(x);
    assert.throws(()=>verifyPublicAccessOverrides(x),/FIRE PUBLIC ACCESS BLOCKED/);
  }
});
