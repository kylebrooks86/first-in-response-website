/** FIRE Gate 6 — two distinct synthetic customer share-token isolation.
 * Runs ONLY inside the existing disposable loopback QA Worker + local D1 test.
 * No hosted QA/LIVE, Cloudflare credentials, real share links, Stripe or R2.
 * Public GETs may record a synthetic first-view marker; never aim at real links.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {syntheticCompleteJobReport} from './synthetic-complete-job-report.mjs';

export async function exerciseGate6ShareIsolation({request,browser,origin,check,mutateSyntheticD1}){
  assert.match(origin,/^https:\/\/127\.0\.0\.1:\d+$/,'Gate 6 isolation must use disposable loopback only');
  const data=[];
  for(const [index,tag] of ['Alpha','Bravo'].entries()){
    const customerName='Synthetic Gate6 '+tag+' Customer';
    const serviceName='Synthetic Gate6 '+tag+' Cleaning';
    const email='gate6-'+tag.toLowerCase()+'@example.invalid';
    const customerResponse=await request('/api/customers','POST',{
      name:customerName,address:(index+1)+'0 Gate6 Synthetic Lane',email
    });
    assert.equal(customerResponse.status(),201,'Synthetic '+tag+' customer created only in local D1');
    const customer=(await customerResponse.json()).customer;
    assert.equal(customer.name,customerName);
    const estimateResponse=await request('/api/estimates','POST',{
      customerId:customer.id,customer:customerName,
      items:[{name:serviceName,description:'Synthetic isolation fixture only',
        quantity:1,unit:'job',totalCents:20000+(index*3000)}]
    });
    assert.equal(estimateResponse.status(),201,'Synthetic '+tag+' estimate created');
    const estimate=await estimateResponse.json();
    assert.ok(estimate.id&&estimate.shareToken&&estimate.customerId===customer.id,
      'Estimate token binds to actual customer');
    const operations=[
      ['/api/public/estimates/'+estimate.shareToken+'/accept','POST',{
        signedName:customerName,acceptedTerms:true,photoRelease:'no'
      },{origin}],
      ['/api/estimates/'+estimate.id,'PATCH',{
        scheduledAt:'2026-10-22T15:00:00.000Z'
      }],
      ['/api/payments','POST',{
        estimateId:estimate.id,requestId:randomUUID(),
        amountCents:Math.floor(estimate.depositCents),method:'Cash'
      }],
      ['/api/job-reports','POST',syntheticCompleteJobReport(estimate.id,customer.id)],
      ['/api/estimates/'+estimate.id,'PATCH',{status:'completed'}]
    ];
    for(const [path,method,body,headers] of operations){
      const response=await request(path,method,body,headers);
      assert.ok(response.ok(),'Local synthetic setup failed: '+path+' ('+response.status()+')');
    }
    const invoiceResponse=await request('/api/invoices','POST',{estimateId:estimate.id});
    assert.equal(invoiceResponse.status(),201,'Synthetic '+tag+' final invoice created');
    const invoice=await invoiceResponse.json();
    assert.ok(invoice.shareToken&&invoice.shareToken!==estimate.shareToken,
      'Estimate and invoice require distinct share tokens');
    data.push({customer,estimate,invoice,customerName,serviceName});
  }
  const [alpha,bravo]=data;
  assert.notEqual(alpha.customer.id,bravo.customer.id);
  assert.notEqual(alpha.estimate.id,bravo.estimate.id);
  assert.notEqual(alpha.estimate.shareToken,bravo.estimate.shareToken);
  assert.notEqual(alpha.invoice.shareToken,bravo.invoice.shareToken);

  const anonymous=await browser.newContext({ignoreHTTPSErrors:true});
  try{
    // Gate 6: an untrusted identity header, fake bearer credential and an
    // invented QA cookie must not turn an anonymous visitor into the owner.
    // These are NEVER the real QA Owner's credentials or hosted tokens.
    const forgedOwner={
      'oai-authenticated-user-email':'kylebrooks8605@gmail.com',
      authorization:'Bearer invented-synthetic-nonowner',
      cookie:'fire_qa_session=v1.9999999999.forged-synthetic-signature',
      'cf-connecting-ip':'192.0.2.66'
    };
    for(const path of ['/api/customers','/api/estimates','/api/invoices',
      '/api/backup','/api/dashboard-summary']){
      const response=await anonymous.request.get(origin+path,{
        headers:forgedOwner,timeout:15000
      });
      const body=await response.text();
      check(response.status()===401&&!body.includes(alpha.customerName)&&
        !body.includes(bravo.customerName)&&
        !body.includes(alpha.estimate.shareToken)&&
        !body.includes(bravo.estimate.shareToken),
        'Local Gate6 forged nonowner identity denied private owner GET '+path);
    }
    for(const path of ['/api/estimates/'+alpha.estimate.id+'/share',
      '/api/invoices/'+bravo.invoice.id+'/share']){
      const response=await anonymous.request.post(origin+path,{
        headers:forgedOwner,data:{},timeout:15000
      });
      const body=await response.text();
      check(response.status()===401&&!body.includes(alpha.estimate.shareToken)&&
        !body.includes(bravo.invoice.shareToken),
        'Local Gate6 forged nonowner identity cannot issue or expose share link '+path);
    }
    // Browser-origin and document-type boundaries for customer token writes.
    // Both requests must fail BEFORE any database mutation is possible.
    for(const current of data){
      for(const [kind,body] of [
        ['accept',{signedName:'Synthetic Cross-Origin Impostor',
          acceptedTerms:true,photoRelease:'no'}],
        ['change-request',{requestId:randomUUID(),
          message:'Cross-site synthetic change must be rejected'}]
      ]){
        const base='/api/public/estimates/';
        const endpoint=base+current.estimate.shareToken+'/'+kind;
        const originDenied=await anonymous.request.post(origin+endpoint,{
          headers:{...forgedOwner,origin:'https://untrusted-gate6.example.invalid'},
          data:body,timeout:15000
        });
        check(originDenied.status()===403,
          'Local Gate6 cross-origin '+kind+' denied for correct share token');
        const wrongDocument=await anonymous.request.post(
          origin+base+current.invoice.shareToken+'/'+kind,{
            headers:{...forgedOwner,origin},data:body,timeout:15000
          });
        const deniedText=await wrongDocument.text();
        check(wrongDocument.status()===404&&
          !deniedText.includes(current.customerName)&&
          !deniedText.includes(current.serviceName),
          'Local Gate6 invoice token cannot invoke public estimate '+kind);
      }
    }
    // A forged authentication email and forged preview hint are never owner
    // authorization. Every token resolves ONLY the one saved customer record.
    for(const current of data){
      const other=current===alpha?bravo:alpha;
      for(const [kind,token,expected] of [
        ['estimate',current.estimate.shareToken,'ESTIMATE'],
        ['invoice',current.invoice.shareToken,'INVOICE'],
        ['pay',current.estimate.shareToken,'ESTIMATE']
      ]){
        const address=origin+'/'+kind+'/'+encodeURIComponent(token)+
          '?ownerPreview=1&from=customer&customerId='+encodeURIComponent(other.customer.id)+
          '&estimateId='+encodeURIComponent(other.estimate.id);
        const response=await anonymous.request.get(address,{
          headers:{'oai-authenticated-user-email':'kylebrooks8605@gmail.com',
            'cf-connecting-ip':'192.0.2.66'},
          timeout:15000
        });
        const html=await response.text();
        check(response.status()===200&&html.includes(current.customerName)&&
          html.includes(current.serviceName)&&!html.includes(other.customerName)&&
          !html.includes(other.serviceName),
          'Local Gate6 '+kind+' share token reveals only its own synthetic '+(current===alpha?'A':'B')+' customer');
        check(!html.includes('owner-estimate-preview-close')&&
          !html.includes('owner-invoice-preview-close')&&
          !html.includes('owner-preview-banner')&&!html.includes('openEstimate=')&&
          !html.includes('openCustomer=')&&!html.includes('openInvoice='),
          'Local Gate6 '+kind+' rejects forged owner preview and cross-customer return controls');
      }
      // A share token issued for one document type must never become an
      // alternate token for a different type of document.
      for(const [path,label] of [
        ['/estimate/'+current.invoice.shareToken,'Estimate not found'],
        ['/invoice/'+current.estimate.shareToken,'Invoice not found'],
        ['/pay/'+current.invoice.shareToken,'Estimate not found'],
        ['/estimate/'+current.customer.id,'Estimate not found'],
        ['/invoice/'+current.estimate.id,'Invoice not found'],
        ['/pay/'+current.estimate.id,'Estimate not found']
      ]){
        const response=await anonymous.request.get(origin+path,{timeout:15000});
        const html=await response.text();
        check(response.status()===200&&html.includes(label)&&
          !html.includes(current.customerName)&&!html.includes(other.customerName),
          'Local Gate6 rejects customer ID, estimate ID and cross-document share-token substitution');
      }
    }
    for(const kind of ['estimate','invoice','pay']){
      const response=await anonymous.request.get(origin+'/'+kind+'/'+randomUUID().replaceAll('-','')+
        '?ownerPreview=1',{headers:{'oai-authenticated-user-email':'kylebrooks8605@gmail.com'},
          timeout:15000});
      const html=await response.text();
      check(response.status()===200&&html.includes(kind==='invoice'?'Invoice not found':'Estimate not found')&&
        !html.includes(alpha.customerName)&&!html.includes(bravo.customerName)&&
        !html.includes('owner-preview-banner')&&!html.includes('owner-estimate-preview-close')&&
        !html.includes('owner-invoice-preview-close'),
        'Local Gate6 nonexistent '+kind+' token stays neutral without owner controls');
    }
    // Guard a corrupted but individually FK-valid invoice relationship:
    // a final invoice must never expose customer B's identity with customer A's
    // estimate/financial records. Mutate ONLY the disposable native local D1,
    // then restore the original synthetic association before leaving.
    const qid=id=>{
      assert.match(id,/^[0-9a-f-]{36}$/i,'Only generated UUID fixtures may enter test-only SQL');
      return "'"+id+"'";
    };
    assert.equal(typeof mutateSyntheticD1,'function');
    await mutateSyntheticD1('UPDATE invoices SET customer_id='+qid(bravo.customer.id)+
      ' WHERE id='+qid(alpha.invoice.id)+';');
    const drift=await anonymous.request.get(origin+'/invoice/'+alpha.invoice.shareToken,
      {timeout:15000});
    const driftHtml=await drift.text();
    check(drift.status()===200&&driftHtml.includes('Invoice not found')&&
      !driftHtml.includes(alpha.customerName)&&!driftHtml.includes(bravo.customerName),
      'Gate6 corrupt invoice/customer linkage fails closed without exposing either customer');
    for(const [kind,required] of [
      ['pay','Billing details need verification.'],
      ['estimate','Billing review required.']
    ]){
      const response=await anonymous.request.get(origin+'/'+kind+'/'+alpha.estimate.shareToken,
        {timeout:15000});
      const html=await response.text();
      check(response.status()===200&&html.includes(alpha.customerName)&&
        !html.includes(bravo.customerName)&&html.includes(required)&&
        !html.includes('Manual payment options:')&&
        !html.includes('arrange the deposit shown above.'),
        'Local Gate6 '+kind+' stays own-customer and blocks all payment methods when an invoice belongs to another customer');
    }
    const stillBravo=await anonymous.request.get(origin+'/invoice/'+bravo.invoice.shareToken,
      {timeout:15000});
    const stillBravoHtml=await stillBravo.text();
    check(stillBravo.status()===200&&stillBravoHtml.includes(bravo.customerName)&&
      !stillBravoHtml.includes(alpha.customerName),
      'Gate6 unrelated customer B invoice remains accessible after A-only drift');
    await mutateSyntheticD1('UPDATE invoices SET customer_id='+qid(alpha.customer.id)+
      ' WHERE id='+qid(alpha.invoice.id)+';');
    const restored=await anonymous.request.get(origin+'/invoice/'+alpha.invoice.shareToken,
      {timeout:15000});
    const restoredHtml=await restored.text();
    check(restored.status()===200&&restoredHtml.includes(alpha.customerName)&&
      !restoredHtml.includes(bravo.customerName),
      'Gate6 original invoice returns only after synthetic same-customer linkage restored');
  }finally{await anonymous.close();}
  console.log('PASS Gate6: two-customer public estimate/invoice/payment isolation, forged-owner hint and wrong-token denial on synthetic loopback only.');
}
