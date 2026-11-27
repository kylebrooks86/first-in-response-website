import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../../../chatgpt-auth';
import {GET as getVerifiedReview} from '../review-draft/route';
import type {BookingReviewDraft} from '../../../../../../lib/booking-review-draft';

const OWNER='kylebrooks8605@gmail.com';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store'}});
const safe=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const money=(c:number)=>'$'+(c/100).toFixed(2);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type SourceRow={subtotalCents:number;totalCents:number;depositCents:number;status:string;acceptedAt:string|null;signedAt:string|null};
type Service={name:string;quantity:number;unit:string;totalCents:number};
type Readback={draft:BookingReviewDraft|null;stale:boolean;revision:string|null};
const bad='Original saved review, service lines or customer financial terms changed. Refresh the internal review; no agreement has been changed.';
/** Private, read-only reviewed handoff worksheet. It is NOT a revision, contract or sendable customer quote. */
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser();
 if(user?.email.toLowerCase()!==OWNER)return json({error:'Unauthorized'},401);
 const {id}=await params;
 if(!uuid.test(id))return json({error:'Invalid estimate reference.'},400);
 try{
  const ctx={params:Promise.resolve({id})};
  const first=await getVerifiedReview(new Request('https://synthetic.invalid/api/estimates/'+id+'/promotion-amendment/review-draft'),ctx);
  if(!first.ok)return json({error:bad},409);
  const verified=await first.json() as Readback;
  const draft=verified.draft;
  if(!draft||verified.stale||verified.revision!==draft.revision)return json({error:'No current verified internal proposal exists. Create or refresh a review draft before preparing a worksheet.'},409);
  const [source,items]=await Promise.all([
   env.DB.prepare('SELECT subtotal_cents AS subtotalCents,total_cents AS totalCents,deposit_cents AS depositCents,status,accepted_at AS acceptedAt,signed_at AS signedAt FROM estimates WHERE id=?')
    .bind(id).first<SourceRow>(),
   env.DB.prepare('SELECT name,quantity,unit,total_cents AS totalCents FROM estimate_items WHERE estimate_id=? ORDER BY rowid ASC')
    .bind(id).all<Service>()
  ]);
  if(!source||source.status!==draft.originalStatus||
    source.subtotalCents<0||source.totalCents!==draft.originalTotalCents||
    source.depositCents!==draft.originalDepositCents||
    Boolean(source.acceptedAt||source.signedAt)!==draft.customerAlreadyAccepted||
    items.results.length===0||items.results.length>60||!items.results.every(item=>
      typeof item.name==='string'&&item.name.length>0&&item.name.length<=160&&!/[\x00-\x1f\x7f]/.test(item.name)&&
      typeof item.unit==='string'&&item.unit.length<=40&&!/[\x00-\x1f\x7f]/.test(item.unit)&&
      typeof item.quantity==='number'&&Number.isFinite(item.quantity)&&item.quantity>0&&
      safe(item.totalCents))||
    items.results.reduce((sum,item)=>sum+item.totalCents,0)!==source.subtotalCents)return json({error:bad},409);
  const confirm=await getVerifiedReview(new Request('https://synthetic.invalid/api/estimates/'+id+'/promotion-amendment/review-draft'),ctx);
  if(!confirm.ok)return json({error:bad},409);
  const reread=await confirm.json() as Readback;
  if(reread.stale||!reread.draft||reread.revision!==draft.revision||
   JSON.stringify(reread.draft)!==JSON.stringify(draft))return json({error:bad},409);
  const special=draft.customerAlreadyAccepted||draft.hasFinancialActivity;
  const lines=[
   'FIRE EXTERIORS | INTERNAL ESTIMATE AMENDMENT WORKSHEET',
   'FOR OWNER REVIEW ONLY — NOT A CUSTOMER AGREEMENT OR APPROVED REVISED QUOTE',
   'Estimate reference: '+id,
   'Owner-attested booking date: '+draft.bookingConfirmedOn,
   'Saved review revision: '+draft.revision,
   'Original estimate status: '+source.status,
   'Services (original agreed scope):',
   ...items.results.map(item=>'• '+item.name+' — '+item.quantity+' '+item.unit+' — '+money(item.totalCents)),
   'Original service subtotal: '+money(source.subtotalCents),
   'Original agreed total: '+money(source.totalCents),
   'Original recorded deposit: '+money(source.depositCents),
   'Potential revised total: '+money(draft.proposedTotalCents),
   'Potential 50% deposit: '+money(draft.proposedDepositCents),
   'Potential additional savings: '+money(draft.possibleSavingsCents),
   'Newly qualifying rules: '+draft.newRules.map(rule=>rule.name+' ('+(rule.type==='percent'?String(rule.valueCents/100)+'%':money(rule.valueCents))+')').join('; '),
   special?'HOLD: Existing acceptance, invoice or payment activity — separately review agreements and financial reconciliation.':
    'HOLD: Revised terms require owner review and explicit customer approval before any amendment.',
   'NO PAYMENT, REFUND, SCHEDULE CHANGE OR MESSAGE HAS BEEN SENT OR AUTHORIZED.',
   'Do not use this worksheet as the official amended estimate.'
  ];
  return json({
   format:'fire-internal-amendment-worksheet-v1',estimateId:id,reviewRevision:draft.revision,
   bookingConfirmedOn:draft.bookingConfirmedOn,originalStatus:source.status,
   requiresCustomerReapproval:true,changesSavedEstimate:false,readyToSend:false,
   requiresFinancialReview:special,
   original:{subtotalCents:source.subtotalCents,totalCents:source.totalCents,depositCents:source.depositCents},
   proposed:{totalCents:draft.proposedTotalCents,depositCents:draft.proposedDepositCents},
   possibleSavingsCents:draft.possibleSavingsCents,
   serviceLines:items.results,
   newRules:draft.newRules,
   worksheetText:lines.join('\n')
  });
 }catch{return json({error:'The saved quote or internal proposal could not be verified. No terms were changed.'},409);}
}
