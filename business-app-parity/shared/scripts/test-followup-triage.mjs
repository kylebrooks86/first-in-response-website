/** Read-only recommended follow-up triage using synthetic timestamps. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const compiled=ts.transpileModule(readFileSync('lib/follow-up-timing.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{},require,Date,Number,Math};vm.runInNewContext(compiled,context);
const triage=context.exports.followupUrgency;assert.equal(typeof triage,'function');
const now=Date.parse('2026-10-21T12:00:00Z'),day=86400000,at=d=>new Date(now+d*day).toISOString();
const job=(template,kind='followup',extra={})=>({kind,template,priority:2,estimate:{status:'sent',firstEstimateSentAt:at(-8),...extra.estimate},...extra});
let n=0;function check(action,bucket,pattern,rank){const r=triage(action,now);assert.equal(r.bucket,bucket);assert.match(r.label,pattern);if(rank!==undefined)assert.equal(r.rank,rank);n++;}
check(job('followUp7'),'past-target',/Past suggested day 7 by 1d/,2);
check(job('followUp3'),'past-target',/Past suggested day 3 by 5d/);
check(job('followUp1','followup',{estimate:{firstEstimateSentAt:at(-1)}}),'due',/Suggested day 1/);
check(job('followUp7','followup',{estimate:{firstEstimateSentAt:null}}),'review',/Confirm estimate send date/);
check(job('invoiceReminder'),'review',/invoice due date unverified/);
check(job('appointmentReminder','followup',{estimate:{scheduledAt:new Date(now+3*3600000).toISOString()}}),'upcoming',/within 3h/,1);
check(job('appointmentReminder','followup',{estimate:{scheduledAt:'invalid'}}),'review',/verification/);
check(job('winBack6','repeat',{dueAt:at(-4)}),'past-target',/passed by 4d/);
check(job('winBack6','repeat',{dueAt:at(10)}),'upcoming',/in 10d/);
check(job('winBack11','repeat',{dueAt:at(0)}),'due',/target reached/);
check(job('review','review'),'review',/Review request suggested/);
check(job('history','history',{estimate:{paymentOverageOpen:1}}),'review',/Billing exception/,0);
check(job('estimate','followup',{estimate:{status:'draft'}}),'review',/Unsent estimate draft/);
const viewCue=context.exports.viewedEstimateReminderCue;
const baseViewed={status:'sent',firstEstimateSentAt:at(-5),lastEstimateSentAt:at(-5),firstViewedAt:at(-1)};
assert.equal(viewCue(baseViewed,now).hoursSinceView,24,'Viewed 24h ago surfaces one owner-side check-in cue');n++;
for(const [name,fields] of Object.entries({
 premature:{firstViewedAt:at(-.9)},unsent:{status:'draft'},approved:{status:'approved'},
 noVerifiedSend:{lastEstimateSentAt:null},oldViewBeforeResend:{lastEstimateSentAt:at(-.5)},
 futureView:{firstViewedAt:at(.1)},malformedView:{firstViewedAt:'unknown'},
 manualContact:{lastManualContactAt:at(-.5)},confirmedFollowup:{lastEstimateContactAt:at(-.5)},
 stageRecorded:{stage3At:at(-.5)},snoozed:{snoozeUntil:at(2)}
})){assert.equal(viewCue({...baseViewed,...fields},now),null,name+' cannot prompt duplicate/premature viewed reminder');n++;}
const attentionJs=ts.transpileModule(readFileSync('lib/attention-estimates.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const attentionContext={exports:{},require:()=>context.exports,Date,Number,Math};
vm.runInNewContext(attentionJs,attentionContext);
const bell=attentionContext.exports.estimateAttentionItems([{...baseViewed,id:'viewed-1',customer:'Synthetic customer',createdAt:at(-5),phone:'9185550000'}],now);
assert.equal(bell.length,1,'Bell produces a single stage-based item for a viewed estimate');n++;
assert.match(bell[0].detail,/Estimate viewed 24h ago · decision not recorded/);n++;
assert.equal(bell[0].estimateId,'viewed-1','Bell retains exact job target');n++;
const invoiced=attentionContext.exports.estimateAttentionItems([{...baseViewed,id:'invoiced',customer:'Invoiced customer',createdAt:at(-5),invoiceId:'invoice-123',invoiceTotalCents:20000,paidCents:0}],now);
assert.equal(invoiced.length,1,'Invoiced viewed estimate does not spawn competing estimate follow-up');n++;
assert.equal(invoiced[0].kind,'invoice','Billing takes precedence over estimate outreach');n++;
assert.equal(invoiced[0].invoiceId,'invoice-123','Billing reminder retains exact invoice navigation');n++;
const overage=attentionContext.exports.estimateAttentionItems([{...baseViewed,id:'overage',customer:'Account issue',createdAt:at(-5),paymentOverageOpen:1}],now);
assert.equal(overage.length,1,'Overpayment exception suppresses secondary viewed reminder');n++;
assert.equal(overage[0].kind,'invoice','Owner sees billing exception first');n++;
const connectedBrowser=readFileSync('scripts/test-connected-records-browser.mjs','utf8');
assert.ok(connectedBrowser.includes("from'./lib/customer-job-journey'"),'Isolated customer browser fixture imports actual job journey helper');n++;
assert.ok(connectedBrowser.includes('estimateReminderStage,viewedEstimateReminderCue'),'Synthetic customer browser includes actual owner timing helpers');n++;
const customerApi=readFileSync('app/api/customers/route.ts','utf8');
for(const column of ['firstEstimateSentAt','stage1At','stage3At','stage7At','lastManualContactAt','snoozeUntil']){
 assert.ok(customerApi.includes('AS '+column),'Customer profile receives canonical reminder history: '+column);n++;
}
const api=readFileSync('app/api/followups/route.ts','utf8'),view=readFileSync('app/dashboard.tsx','utf8');
assert.match(api,/channel IN \('text_confirmed','email_confirmed'\)\) AS lastConfirmedMessageAt/);
assert.match(api,/channel IN \('text_prepared','email_prepared','copy'\)\) AS lastPreparedAt/);
assert.match(api,/e\.first_viewed_at AS firstViewedAt/);
assert.match(view,/Estimate viewed · approval not implied/);
assert.match(view,/viewedEstimateReminderCue\(estimate,now\)/);
assert.match(view,/Viewed estimate · check in/);
assert.match(view,/Link opened .*hours ago · approval not recorded/);
assert.match(view,/estimate\.invoiceId\)continue/);
assert.match(view,/Owner-confirmed message:/);assert.match(view,/Last prepared\/copied:/);
assert.match(view,/Timing: /);assert.match(view,/setUrgencyFilter\("all"\)/);
assert.match(view,/followupUrgency\(item,now\)\.bucket==="past-target"/);
assert.match(view,/followupUrgency\(item,now\)\.rank<=1/);
// Review prompts in Follow-ups must follow verified financial/review safety state.
const reviewSource=readFileSync('lib/review-followup-eligibility.ts','utf8');
const reviewContext={exports:{},Date,Number};
vm.runInNewContext(ts.transpileModule(reviewSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,reviewContext);
const canReview=reviewContext.exports.reviewFollowupEligible;
const good={status:'completed',billingTotalCents:20000,paidCents:20000,paymentOverageOpen:0,pendingRefundCount:0,openCheckoutCount:0};
assert.equal(canReview(good,5,now),true,'Paid-in-full completed job may appear in review workflow');
for(const [name,change] of Object.entries({
 unconfirmedPayment:{paidCents:10000},overpaid:{paidCents:25000},pendingRefund:{pendingRefundCount:1},
 unresolvedCheckout:{openCheckoutCount:1},openOverage:{paymentOverageOpen:1},
 missingCheckoutVerification:{openCheckoutCount:undefined},missingRefundVerification:{pendingRefundCount:undefined},
 alreadyRequested:{lastReviewRequestAt:at(-3)},received:{reviewReceivedAt:at(-1)},
 futureSnooze:{reviewSnoozeUntil:at(7)},invalidSnooze:{reviewSnoozeUntil:'unknown'},
 unfinished:{status:'scheduled'},zeroPrice:{paidCents:0,billingTotalCents:0}
})){
 assert.equal(canReview({...good,...change},5,now),false,name+' cannot create a premature or repeat review follow-up');
 n++;
}
assert.equal(canReview({...good,reviewSnoozeUntil:at(-1)},5,now),true,'Elapsed snooze reopens safe review reminder');
assert.equal(canReview(good,31,now),false,'General Follow-ups review cadence stays limited to 30 days');
for(const key of ['pendingRefundCount','openCheckoutCount','reviewReceivedAt','reviewSnoozeUntil']){
 assert.ok(api.includes('AS '+key),key+' is read from real owner-scoped follow-up records');
}
assert.ok(view.includes('reviewFollowupEligible({...estimate,billingTotalCents:resolvedBillingTotalCents(estimate)},serviceAgeDays,now)'), 'Actual Follow-ups screen uses guarded helper');
const journeyContext={exports:{},Date,Number};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/customer-job-journey.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,journeyContext);
const journey=journeyContext.exports.customerJobJourney;
const sample={id:'e1',service:'House wash',status:'sent',createdAt:at(-3),firstEstimateSentAt:at(-3),firstViewedAt:at(-2),depositCents:5000,paidCents:0,paymentOverageOpen:0,pendingRefundCount:0,openCheckoutCount:0};
const initial=journey(sample,[]);
assert.equal(initial.headline,'Viewed · awaiting approval');
assert.deepEqual(Array.from(initial.steps.map(s=>s.key)),['sent','viewed','followup','approved','deposit','scheduled']);
assert.equal(initial.steps.find(s=>s.key==='viewed').state,'done');
assert.equal(initial.steps.find(s=>s.key==='approved').state,'pending');n+=4;
assert.equal(journey(sample,[{estimateId:'e1',template:'followUp3',channel:'text_prepared',createdAt:at(-1)}]).steps[2].state,'pending','Prepared text not sent');n++;
assert.equal(journey(sample,[{estimateId:'e1',template:'followUp3',channel:'contact_recorded',createdAt:at(-1)}]).steps[2].state,'verify','Manual contact not message sent');n++;
assert.equal(journey(sample,[{estimateId:'foreign',template:'followUp3',channel:'text_confirmed',createdAt:at(-1)}]).steps[2].state,'pending','Other job cannot count as send');n++;
const approvedJourney=journey({...sample,status:'approved',acceptedAt:at(-1),paidCents:5000},[{estimateId:'e1',template:'followUp3',channel:'email_confirmed',createdAt:at(-2)}]);
assert.equal(approvedJourney.steps[2].state,'done');
assert.equal(approvedJourney.steps[3].state,'done');
assert.equal(approvedJourney.steps[4].state,'done');
assert.match(approvedJourney.steps[4].detail,/not a separate deposit receipt/);n+=4;
assert.equal(journey({...sample,status:'scheduled',scheduledAt:at(2),paidCents:5000},[]).steps[5].state,'done');n++;
assert.equal(journey({...sample,status:'sent',scheduledAt:at(2)},[]).steps[5].state,'verify');n++;
assert.equal(journey({...sample,status:'approved',paidCents:5000,paymentOverageOpen:1},[]).steps[4].state,'verify');n++;
assert.equal(journey({...sample,status:'approved',paidCents:5000,pendingRefundCount:1},[]).steps[4].state,'verify','Pending refund prevents verified deposit milestone');n++;
assert.equal(journey({...sample,status:'approved',paidCents:5000,openCheckoutCount:1},[]).steps[4].state,'verify','Open Stripe checkout prevents verified deposit milestone');n++;
assert.equal(journey({...sample,status:'approved',paidCents:5000,openCheckoutCount:undefined},[]).steps[4].state,'verify','Missing checkout status fails closed');n++;
for(const key of ['pendingRefundCount','openCheckoutCount']){assert.ok(customerApi.includes('AS '+key),'Customer job includes '+key+' safety state');n++;}
assert.ok(view.includes('Customer estimate to scheduled job journey')&&view.includes('customerJobJourney(estimate,customerMessages)'),'Customer profile uses existing job records');n++;
assert.ok(view.includes('Estimate link viewed')&&view.includes('Link opened · viewer identity and intent unverified'),'Timeline labels views correctly');n++;
// Daily owner screens stay short without losing proof or financial safeguards.
const ownerPaymentSection=view.slice(view.indexOf('function PaymentsView('),view.indexOf('function BusinessView(')>0?view.indexOf('function BusinessView('):undefined);
assert.ok(ownerPaymentSection.indexOf('Card checkouts needing review')<ownerPaymentSection.indexOf('Collectible job balances'),'Unresolved Stripe checkouts still warn before recording more money');n++;
assert.ok(ownerPaymentSection.indexOf('Collectible job balances')<ownerPaymentSection.indexOf('Job Closeout Center'),'Everyday balances appear before secondary review administration');n++;
assert.ok(ownerPaymentSection.includes('Payment history')&&ownerPaymentSection.includes('RecordPayment'),'All payment controls and history remain accessible');n++;
const followUpSection=view.slice(view.indexOf('function FollowUpsView('),view.indexOf('function PaymentsView('));
assert.ok(followUpSection.includes('className="followup-message-details"'),'Historical message timestamps remain available under a disclosure');n++;
assert.ok(followUpSection.indexOf('No answer / Not contacted')<followUpSection.indexOf('className="followup-message-details"'),'No-answer / not-contacted filter remains directly accessible');n++;
assert.ok(followUpSection.includes('Not contacted ·')&&followUpSection.includes('onClick={()=>void recordAction(estimate,"no_answer")}'),'Unanswered outreach stays visibly marked and loggable');n++;
assert.ok(followUpSection.includes('Saved estimate activity (')&&followUpSection.includes('Recent contact'),'Full milestone and contact history remain available');n++;
assert.ok(ownerPaymentSection.includes('const [showAllPayments,setShowAllPayments]=useState(false)'),'Payment history starts compact without changing saved ledger');n++;
assert.ok(ownerPaymentSection.includes('(showAllPayments?payments:payments.slice(0,8)).map('),'All transactions and refund actions remain renderable');n++;
assert.ok(ownerPaymentSection.includes('View all ${payments.length} payments')&&ownerPaymentSection.includes('Show recent 8 payments'),'One-tap full payment history remains visible to owner');n++;
assert.ok(followUpSection.includes('className="followup-summary-details"')&&followUpSection.includes('bucketCount("past-target")')&&followUpSection.includes('bucketCount("due")'),'Compact follow-up header keeps urgent counts visible with optional breakdown');n++;
const scheduleOwnerSection=view.slice(view.indexOf('function ScheduleView('),view.indexOf('function InvoicesView('));
assert.ok(scheduleOwnerSection.includes('className="schedule-turnaround-review"')&&scheduleOwnerSection.includes('className="schedule-turnaround-details"'),'Closely spaced appointment warning stays visible while detailed pairs collapse');n++;
assert.ok(scheduleOwnerSection.includes('className="schedule-turnaround-job"')&&scheduleOwnerSection.includes('onClick={()=>setSelected(job)}'),'Each affected schedule job stays navigable from the full warning');n++;
console.log('PASS '+n+' timing, reviewed journey milestones, billing guards, and compact daily owner screen contracts.');
