/** Real customer profile manual lead-contact flags, no owner DB or network. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 deriveCustomerManualFlags, LEAD_NO_ANSWER_NOTE, LEAD_CONTACTED_NOTE,
 LEAD_CALLBACK_HANDLED_NOTE, leadCallbackNote,
 REVIEW_RECEIVED_NOTE, SIGN_PICKED_UP_NOTE, signPlacedNote
} from '../lib/customer-activity-flags.ts';

let count=0;
const check=(condition,message)=>{assert.ok(condition,message);count++;};
const note=(id,body,at)=>({id,body,createdAt:at});
const a='2026-10-20T10:00:00.000Z',b='2026-10-21T10:00:00.000Z',
 c='2026-10-22T10:00:00.000Z',d='2026-10-23T10:00:00.000Z';
const first=deriveCustomerManualFlags([note('1',LEAD_NO_ANSWER_NOTE,a)]);
check(first.leadContact?.state==='no_answer'&&first.leadContact.unansweredAttempts===1,
 'One unanswered lead call is not marked contacted, even without an estimate');
const repeated=deriveCustomerManualFlags([
 note('4',LEAD_NO_ANSWER_NOTE,d),
 note('2',LEAD_NO_ANSWER_NOTE,b),
 note('1',LEAD_NO_ANSWER_NOTE,a)
]);
check(repeated.leadContact?.state==='no_answer'&&repeated.leadContact.unansweredAttempts===3&&repeated.leadContact.at===d,
 'Three unanswered attempts are counted in chronological order, not document order');
const recovered=deriveCustomerManualFlags([
 note('3',LEAD_CONTACTED_NOTE,c),note('1',LEAD_NO_ANSWER_NOTE,a),note('2',LEAD_NO_ANSWER_NOTE,b)
]);
check(recovered.leadContact?.state==='contacted'&&recovered.leadContact.unansweredAttempts===2,
 'Later owner-recorded actual contact clears the no-answer state without erasing attempts');
const missedAgain=deriveCustomerManualFlags([
 note('3',LEAD_CONTACTED_NOTE,c),note('1',LEAD_NO_ANSWER_NOTE,a),
 note('4',LEAD_NO_ANSWER_NOTE,d)
]);
check(missedAgain.leadContact?.state==='no_answer'&&missedAgain.leadContact.unansweredAttempts===2,
 'A later missed callback does not falsely claim contact on that attempt');
check(deriveCustomerManualFlags([note('bad',LEAD_CONTACTED_NOTE,'invalid')]).leadContact===null,
 'Invalid contact timestamp cannot create a current contact flag');
const before=deriveCustomerManualFlags([
 note('n',LEAD_NO_ANSWER_NOTE,a),
 note('r',REVIEW_RECEIVED_NOTE,b),
 note('s',signPlacedNote('2026-10-30','Front lawn'),c),
 note('p',SIGN_PICKED_UP_NOTE,d)
]);
check(before.leadContact?.state==='no_answer'&&before.reviewReceivedAt===b&&before.sign?.state==='picked_up',
 'Existing review receipt and yard sign history remain independent of lead contact notes');
check(deriveCustomerManualFlags([note('other','Customer asked for callback',d)]).leadContact===null,
 'Ordinary private customer notes do not silently imply a contacted/not-contacted status');
const scheduled=leadCallbackNote('2026-10-25');
check(scheduled==='[FIRE FLAG] LEAD_CALLBACK | due:2026-10-25',
 'Saved callback marker contains a strict owner-selected calendar date');
for(const invalid of ['2026-02-30','2026-13-01','2026-00-10','tomorrow','2026-1-1','2026-10-25\\nNOTES']){
 assert.throws(()=>leadCallbackNote(invalid),/valid callback date/, 'Invalid callback refused: '+invalid);count++;
}
const pending=deriveCustomerManualFlags([note('cb',scheduled,b),note('missed',LEAD_NO_ANSWER_NOTE,c)]);
check(pending.leadCallback?.state==='pending'&&pending.leadCallback.dueDate==='2026-10-25'&&pending.leadContact?.state==='no_answer',
 'No answer after a scheduled callback does not silently erase due reminder or claim contact');
const handled=deriveCustomerManualFlags([
 note('cb',scheduled,b),note('handled',LEAD_CALLBACK_HANDLED_NOTE,d)
]);
check(handled.leadCallback?.state==='handled'&&handled.leadCallback.dueDate==='2026-10-25'&&handled.leadContact===null,
 'Owner may mark a callback handled without falsely recording successful contact');
const actualContact=deriveCustomerManualFlags([
 note('cb',scheduled,b),note('contact',LEAD_CONTACTED_NOTE,d)
]);
check(actualContact.leadCallback?.state==='handled'&&actualContact.leadContact?.state==='contacted',
 'Actual later contact closes the scheduled callback and independently logs contact');
const rescheduled=deriveCustomerManualFlags([
 note('old',leadCallbackNote('2026-10-24'),a),
 note('new',scheduled,c),
 note('prior',LEAD_CALLBACK_HANDLED_NOTE,b)
]);
check(rescheduled.leadCallback?.state==='pending'&&rescheduled.leadCallback.dueDate==='2026-10-25',
 'Scheduling a new callback after previous one handled reopens exactly the newer date');
const malformed=deriveCustomerManualFlags([note('bad','[FIRE FLAG] LEAD_CALLBACK | due:2026-02-30',d)]);
check(malformed.leadCallback===null,
 'Malformed owner note does not create an invented reminder');
check(deriveCustomerManualFlags([note('handled',LEAD_CALLBACK_HANDLED_NOTE,d)]).leadCallback===null,
 'Orphan callback-handled note cannot invent a previously scheduled callback');
const dashboard=readFileSync('app/dashboard.tsx','utf8');
const noteApi=readFileSync('app/api/customer-notes/route.ts','utf8');
for(const [flag,action] of [['LEAD_NO_ANSWER_NOTE','no_answer'],['LEAD_CONTACTED_NOTE','contacted']]){
 check(dashboard.includes('saveNote('+flag+',"'+action+'")')&&dashboard.includes('noteAttempts.current.get(attemptKey)')&&dashboard.includes('noteSaveLock.current'),
  'One-tap contact outcome persists with the existing idempotent note API: '+flag);
}
check(dashboard.includes('No answer · not contacted on the latest logged attempt'),
 'Saved customer card presents the missed-call status honestly');
check(dashboard.includes('No contact outcome logged.')&&dashboard.includes('leadContact?.state==="contacted"'),
 'Missing lead outcome is distinct from a confirmed contacted state');
check(dashboard.includes('manuallyUnansweredLeadIds')&&dashboard.includes('showUnansweredLeadsOnly'),
 'Customer directory can filter exact owner-logged unanswered leads, even with no estimate');
check(dashboard.includes('manuallyUnansweredLeadIds')&&dashboard.includes('manualFlags=deriveCustomerManualFlags(customerNotes)'),
 'Directory reads explicit customer note flags without fabricating estimate outreach');
check(dashboard.includes('setShowUnansweredLeadsOnly(current=>!current)'),
 'Directory filter can be turned off to restore the complete customer list');
check(dashboard.includes('leadContact?.state==="no_answer"')&&dashboard.includes('followupContactRecorded'),
 'Customer-level lead notes and estimate-level contact still have independent state');
check(dashboard.includes('dueLeadCallbacks')&&dashboard.includes('showDueCallbacksOnly')&&
 dashboard.includes('aria-label="Due customer lead callbacks"'),
 'Customer directory has a due-only callback filter and navigable owner review queue');
check(dashboard.includes('saveNote(leadCallbackNote(callbackDate))')&&
 dashboard.includes('saveNote(LEAD_CALLBACK_HANDLED_NOTE,"handled")')&&
 dashboard.includes('noteAttempts.current.get(attemptKey)')&&dashboard.includes('noteSaveLock.current'),
 'One-tap callback saves through the existing idempotent note API; handled markers still need explicit save');
check(dashboard.includes('Callback dates are tracked here; no automatic alerts.'),
 'Shorter UI accurately states there are no automatic callback alerts');
check(noteApi.includes('INSERT OR IGNORE INTO customer_notes')&&noteApi.includes('requestId'),
 'Existing owner-scoped note API safely persists explicit notes using idempotent request IDs');
console.log('PASS '+count+' lead contact and direct callback save contracts; no remote writes.');
