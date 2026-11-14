/** Scoped owner Text/Email preparation against the REAL built QA Worker and D1.
 * Called by the loopback-only browser suite. No external SMS/email/provider calls.
 */
import {randomUUID} from 'node:crypto';

export async function verifyAnonymousMessageDenial(request,check) {
  const read=await request('/api/customer-messages?customerId=untrusted');
  check(read.status()===401,
    'Real built QA denies anonymous message history before reading customer records');
  const write=await request('/api/customer-messages','POST',{
    customerId:'untrusted',channel:'text_prepared',body:'DO NOT SEND'
  });
  check(write.status()===401,
    'Real built QA denies unauthenticated Text preparation before any database write');
}

export async function verifySignedMessageHandoff({request,page,customer,estimate,check}) {
  const query=new URLSearchParams({customerId:customer.id,estimateId:estimate.id});
  const endpoint='/api/customer-messages?'+query.toString();
  const before=await request(endpoint);
  const beforeBody=await before.json();
  check(before.status()===200&&Array.isArray(beforeBody.pending),
    'Real signed owner QA cookie opens customer/estimate-scoped prepared message history');

  const requestId=randomUUID(),body='Synthetic QA prepared message. DO NOT SEND.';
  const payload={customerId:customer.id,estimateId:estimate.id,channel:'text_prepared',
    template:'estimate',body,requestId};
  const response=await request('/api/customer-messages','POST',payload);
  const preparedResponse=await response.json(),prepared=preparedResponse.message;
  check(response.status()===201&&prepared?.id==='owner-message-prep:'+requestId&&
    prepared.customerId===customer.id&&prepared.estimateId===estimate.id&&
    prepared.channel==='text_prepared'&&prepared.body===body,
    'Real QA owner Text preparation saves an exact immutable scoped draft, never sends');

  const repeat=await request('/api/customer-messages','POST',payload),repeatBody=await repeat.json();
  check(repeat.status()===200&&repeatBody.duplicate===true&&
    repeatBody.message?.id===prepared.id&&repeatBody.message?.createdAt===prepared.createdAt,
    'Same owner request ID recovers one durable saved message without duplication');

  const pending=await request(endpoint),pendingBody=await pending.json();
  check(pending.status()===200&&pendingBody.pending?.some(m=>m.id===prepared.id&&m.body===body),
    'Actual QA SQLite message history returns the unsent prepared draft to the owner');

  // Use the same real 390-pixel Chromium browser context as the dashboard and
  // its HttpOnly SameSite=Strict signed cookie. A direct fake header is NOT auth.
  const browserReply=await page.evaluate(async({url})=>{
    const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});
    const data=await response.json();
    return {status:response.status,pending:data.pending};
  },{url:endpoint});
  check(browserReply.status===200&&browserReply.pending?.some(m=>m.id===prepared.id),
    'Actual hydrated mobile-width browser includes signed QA cookie on message GET');

  const cancel=await request('/api/customer-messages','PATCH',{
    preparedMessageId:prepared.id,customerId:customer.id,ownerConfirmedNotSent:true
  });
  const cancelled=await cancel.json();
  check(cancel.status()===200&&cancelled.cancelled===true&&
    cancelled.message?.id===prepared.id+':owner-cancelled',
    'QA owner can cancel the untransmitted text, retaining immutable audit history');
  const after=await request(endpoint),afterBody=await after.json();
  check(after.status()===200&&Array.isArray(afterBody.pending)&&
    !afterBody.pending.some(m=>m.id===prepared.id),
    'Cancelled prepared text disappears from pending without any send claim');
  const replay=await request('/api/customer-messages','POST',payload);
  check(replay.status()===409,
    'Cancelled message is never reopened for handoff by replaying an old request ID');
}
