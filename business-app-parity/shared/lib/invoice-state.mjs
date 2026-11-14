/** Read-only current invoice state. Historical invoice/revision rows stay intact. */
export function invoicePaymentState(row){
 const total=row.totalCents,paid=row.paidCents;
 const safe=Number.isSafeInteger(total)&&total>=0&&Number.isSafeInteger(paid)&&paid>=0;
 const known=['draft','sent','partial','paid'].includes(row.status);
 const review=!safe||!known||(safe&&paid>total)||Number(row.paymentOverageOpen??0)>0||Number(row.pendingRefundCount??0)>0;
 const balanceCents=safe?Math.max(0,total-paid):null;
 // A zero-total invoice with zero received dollars is not a paid receipt.
 // Excess principal also needs review rather than a misleading settled badge.
 const status=!safe?'review':!known?row.status:paid>total?'review':total>0&&balanceCents===0?'paid':paid>0?'partial':row.firstViewedAt||row.status==='sent'||(total>0&&row.status!=='draft')?'sent':'draft';
 return {safe,status,review,balanceCents};
}
export function currentInvoice(row){const state=invoicePaymentState(row);return {...row,storedStatus:row.status,status:state.status,paymentReviewPending:state.review,balanceCents:state.balanceCents};}
export function invoicePaymentMessage(state){
 if(state.review)return 'Your account is being reviewed. Please do not send another payment until First In Response Exteriors confirms the amount due.';
 if(state.balanceCents===0)return state.status==='paid'
  ?'Thank you for choosing First In Response Exteriors. This invoice is paid in full. No additional invoice payment is due.'
  :'No payment is due for this invoice.';
 return null;
}
