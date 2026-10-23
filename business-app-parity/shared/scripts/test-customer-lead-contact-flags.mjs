/** Real customer profile manual lead-contact flags, no owner DB or network. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 deriveCustomerManualFlags, LEAD_NO_ANSWER_NOTE, LEAD_CONTACTED_NOTE,
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
const dashboard=readFileSync('app/dashboard.tsx','utf8');
const noteApi=readFileSync('app/api/customer-notes/route.ts','utf8');
for(const flag of ['LEAD_NO_ANSWER_NOTE','LEAD_CONTACTED_NOTE']){
 check(dashboard.includes('prepareManualFlag('+flag+')'),
  'Owner profile has a real explicit Add note preparation for '+flag);
}
check(dashboard.includes('No answer · not contacted on the latest logged attempt'),
 'Saved customer card presents the missed-call status honestly');
check(dashboard.includes('No lead contact outcome logged. This is not proof that no contact occurred.'),
 'Missing lead outcome is not misreported as definitely uncontacted');
check(dashboard.includes('This manual lead log is separate from estimate-specific follow-up history'),
 'Customer-level lead note and estimate-level contact stay distinct');
check(noteApi.includes('INSERT OR IGNORE INTO customer_notes')&&noteApi.includes('requestId'),
 'Existing owner-scoped note API safely persists explicit notes using idempotent request IDs');
console.log('PASS '+count+' lead No answer/Contacted history and real Customer profile note-preparation contracts; no remote writes.');
