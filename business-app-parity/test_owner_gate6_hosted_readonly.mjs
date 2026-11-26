/** Offline safety tests for optional OWNER-RUN hosted Gate 6 collector.
 * Must never fetch remote QA URLs or render customer/share token values.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {QA_ORIGIN,DOC_KINDS,validateViewedLink,examineDocument,visiblePrompt}
  from './owner_gate6_hosted_readonly.mjs';
const token='A'.repeat(32);
test('same immutable QA host, exactly expected public paths',()=>{
  assert.deepEqual(DOC_KINDS,['estimate','invoice','pay']);
  for(const kind of DOC_KINDS){
    const url=QA_ORIGIN+'/'+kind+'/'+token;
    assert.equal(validateViewedLink(url,kind),url);
  }
});
test('reject remote alternatives, query hints, private state, wrong-type tokens',()=>{
  const bad=[
    'http://fire-fullapp-qa-20261016.kyle-bfc.workers.dev/estimate/'+token,
    'https://firstinresponseexteriors.com/estimate/'+token,
    'https://fire-app.kylebrooks8605.chatgpt.site/estimate/'+token,
    'https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev.evil.example/estimate/'+token,
    QA_ORIGIN+'/estimate/'+token+'?ownerPreview=1',
    QA_ORIGIN+'/estimate/'+token+'#secret',
    QA_ORIGIN+'/estimate/'+token+'/extra',
    QA_ORIGIN+'/api/customers',
    QA_ORIGIN+'/estimate/short',
    QA_ORIGIN+'/estimate/%2E%2E',
    QA_ORIGIN+'/estimate/aaa%2Fbbb',
    QA_ORIGIN+'/invoice/'+token,
    QA_ORIGIN+'/estimate/'+token+'\n',
    'https://owner:secret@fire-fullapp-qa-20261016.kyle-bfc.workers.dev/estimate/'+token,
  ];
  for(const input of bad)assert.throws(()=>validateViewedLink(input,'estimate'),
    'Must refuse unexpected host, path, or token without sending a request');
});
test('must identify saved own synthetic customer and not show the other',()=>{
  const own='Synthetic Alpha Customer',other='Synthetic Bravo Customer';
  assert.equal(examineDocument('<html><main>'+own+'</main></html>',own,other).ok,true);
  assert.equal(examineDocument('<html><main>'+other+'</main></html>',own,other).ok,false);
  assert.equal(examineDocument('<html><main>Unknown</main></html>',own,other).ok,false);
});
test('owner-only browser return controls cause refusal',()=>{
  for(const hint of ['owner-preview-banner','owner-estimate-preview-close',
    'owner-invoice-preview-close','openCustomer=','openInvoice=']){
    const body='<html><main>Synthetic Alpha Customer '+hint+'</main></html>';
    assert.equal(examineDocument(body,'Synthetic Alpha Customer','Synthetic Bravo Customer').ok,false);
  }
});
test('reject empty, oversized, or non-HTML untrusted responses',()=>{
  assert.equal(examineDocument('','Alpha','Bravo').ok,false);
  assert.equal(examineDocument('A'.repeat(2_000_001),'Alpha','Bravo').ok,false);
  assert.equal(examineDocument(null,'Alpha','Bravo').ok,false);
});

test('Acer consent prompts resolve actual trimmed answers across repeated questions',async()=>{
  // This reproduces the owner's original undefined.trim() crash using actual
  // readline semantics. No TTY credential, QA network or share link involved.
  const input=new PassThrough();
  const output=new PassThrough();
  let shown='';
  output.on('data',chunk=>{shown+=chunk.toString();});
  try{
    const consent=visiblePrompt('Synthetic QA only? ',{input,output});
    input.write('  YES  \\r\\n'.replaceAll('\\r','\r').replaceAll('\\n','\n'));
    assert.equal(await consent,'YES');
    const marker=visiblePrompt('Customer A fictional marker? ',{input,output});
    input.write(' Synthetic Alpha Customer \\r\\n'.replaceAll('\\r','\r').replaceAll('\\n','\n'));
    assert.equal(await marker,'Synthetic Alpha Customer');
    assert.ok(shown.includes('Synthetic QA only? '));
    assert.ok(shown.includes('Customer A fictional marker? '));
    assert.ok(!shown.includes('Synthetic Alpha Customer'),'Prompts never echo simulated marker input');
  }finally{
    input.destroy();
    output.destroy();
  }
});


test('G6 anonymous body inspection requires exact small JSON denial and private headers',async()=>{
  const {inspectBoundedAnonymousDenial}=await import('./owner_gate6_hosted_readonly.mjs');
  const headers={'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store, private','Vary':'Accept, Cookie',
    'X-Content-Type-Options':'nosniff'};
  const reply=(body,opts={})=>new Response(body,{status:401,headers:{...headers,...opts}});
  assert.deepEqual(await inspectBoundedAnonymousDenial(reply('{"error":"Unauthorized"}')),
    {exactDenial:true,sessionPrivate:true});
  for(const body of ['{"error":"Unauthorized","customer":"private"}',
                     '{"error":"Unauthorized","shareToken":"secret"}',
                     'private HTML', 'x'.repeat(1100)]){
    const r=await inspectBoundedAnonymousDenial(reply(body));
    assert.equal(r.exactDenial,false);
  }
  const noStore=await inspectBoundedAnonymousDenial(reply('{"error":"Unauthorized"}',
    {'Cache-Control':'public, max-age=60'}));
  assert.equal(noStore.exactDenial,true);
  assert.equal(noStore.sessionPrivate,false);
  assert.equal((await inspectBoundedAnonymousDenial(
    new Response('private',{status:200}))).exactDenial,false);
});
test('G6 anonymous collector is fixed-origin, no-credential, GET-only and sanitized',async()=>{
  const {QA_DENIAL_BODY_PATHS,captureQaAnonymousDenialBodies}=
    await import('./owner_gate6_hosted_readonly.mjs');
  const requests=[];
  const good=()=>new Response('{"error":"Unauthorized"}',{status:401,headers:{
    'Content-Type':'application/json','Cache-Control':'private, no-store',
    'Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
  const receipt=await captureQaAnonymousDenialBodies({fetcher:async(url,init)=>{
    requests.push({url,init});return good();
  }});
  assert.equal(receipt.result,'G6_ANONYMOUS_DENIAL_BODY_PRIVACY_PASS');
  assert.equal(receipt.expiredSignedSessionVerified,false);
  assert.equal(receipt.gate6CriterionAccepted,false);
  assert.equal(receipt.providerWrites,false);
  assert.equal(requests.length,QA_DENIAL_BODY_PATHS.length);
  for(let i=0;i<requests.length;i++){
    assert.equal(requests[i].url,QA_ORIGIN+QA_DENIAL_BODY_PATHS[i]);
    assert.equal(requests[i].init.method,'GET');
    assert.equal(requests[i].init.credentials,'omit');
    assert.equal(requests[i].init.redirect,'manual');
    assert.equal(requests[i].init.headers.Accept,'application/json');
    assert.equal(JSON.stringify(requests[i]).includes('Cookie'),false);
  }
  const fail=await captureQaAnonymousDenialBodies({fetcher:async()=>{throw Error('secret cookie x');}});
  assert.equal(fail.evidence.every(e=>e.passed),false);
  assert.equal(JSON.stringify(fail).includes('secret cookie'),false);
});
