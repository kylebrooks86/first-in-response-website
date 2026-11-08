import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../../../chatgpt-auth';
import {POST as verifyOriginalQuote} from '../route';
import {BOOKING_REVIEW_DRAFT_PREFIX,readBookingReviewDraft,type BookingReviewDraft} from '../../../../../../lib/booking-review-draft';
import {estimateScopeFingerprint} from '../../../../../../lib/estimate-scope-fingerprint';
const OWNER='kylebrooks8605@gmail.com';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store, private'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function authorized(){const u=await getChatGPTUser();return u?.email.toLowerCase()===OWNER;}
type Preview={estimateId:string;bookingConfirmedOn:string;status:string;originalCatalogRevision:string|null;
 customerAlreadyAccepted:boolean;hasFinancialActivity:boolean;
 current:{totalCents:number;depositCents:number};
 proposed:{totalCents:number;depositCents:number};
 possibleSavingsCents:number;newlyEligible:BookingReviewDraft['newRules'];
 changesSavedEstimate:false;requiresReviewedAmendment:true};
async function verifiedPreview(id:string,bookingConfirmedOn:string):Promise<{preview:Preview|null;reason:string}>{
 const result=await verifyOriginalQuote(new Request('https://synthetic.invalid/api/estimates/'+encodeURIComponent(id)+'/promotion-amendment',
 {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({bookingConfirmedOn})}),{params:Promise.resolve({id})});
 if(!result.ok)return{preview:null,reason:'Saved estimate or promotion eligibility changed. Recheck the original quote manually.'};
 const p=await result.json() as Preview;
 if(p.estimateId!==id||p.bookingConfirmedOn!==bookingConfirmedOn||p.changesSavedEstimate!==false||
  p.requiresReviewedAmendment!==true||!Number.isSafeInteger(p.current?.totalCents)||
  !Number.isSafeInteger(p.proposed?.totalCents)||!Number.isSafeInteger(p.possibleSavingsCents)||
  p.current.totalCents-p.proposed.totalCents!==p.possibleSavingsCents||p.possibleSavingsCents<=0||
  !Array.isArray(p.newlyEligible)||p.newlyEligible.length===0)
  return{preview:null,reason:'No new positive savings are currently eligible. The agreed quote has not changed.'};
 return{preview:p,reason:''};
}
async function read(id:string){
 const row=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(BOOKING_REVIEW_DRAFT_PREFIX+id).first<{body:string}>();
 return {body:row?.body??null,draft:readBookingReviewDraft(row?.body??null,id)};
}
/** Internal review draft only; no customer delivery or estimate/financial mutations. */
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 if(!await authorized())return json({error:'Unauthorized'},401);
 const {id}=await params;
 try{
  const {draft}=await read(id);
  if(!draft)return json({draft:null,stale:false,revision:null});
  const checked=await verifiedPreview(id,draft.bookingConfirmedOn);
  const p=checked.preview;
  const scopeHash=await estimateScopeFingerprint(id);
  const stale=!p||scopeHash!==draft.originalScopeSha256||p.originalCatalogRevision!==draft.catalogRevision||
   p.current.totalCents!==draft.originalTotalCents||p.current.depositCents!==draft.originalDepositCents||
   p.proposed.totalCents!==draft.proposedTotalCents||p.proposed.depositCents!==draft.proposedDepositCents||
   p.status!==draft.originalStatus||p.customerAlreadyAccepted!==draft.customerAlreadyAccepted||
   p.hasFinancialActivity!==draft.hasFinancialActivity||
   JSON.stringify(p.newlyEligible)!==JSON.stringify(draft.newRules);
  return json({draft,revision:draft.revision,stale,reason:stale?'This internal draft is outdated. Recalculate and save a new review before relying on amounts.':''});
 }catch{return json({error:'Saved internal review data could not be verified. No quote was changed.'},409);}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!await authorized())return json({error:'Unauthorized'},401);
 const {id}=await params;
 let body:Record<string,unknown>;
 try{const parsed=await request.json();if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('bad');body=parsed as Record<string,unknown>;}
 catch{return json({error:'Invalid owner draft request.'},400);}
 if(Object.keys(body).sort().join(',')!=='bookingConfirmedOn,expectedOriginalTotalCents,expectedProposedTotalCents,expectedRevision,ownerNote'||
  typeof body.bookingConfirmedOn!=='string'||typeof body.ownerNote!=='string'||body.ownerNote.length>400||
  !(body.expectedRevision===null||typeof body.expectedRevision==='string'&&uuid.test(body.expectedRevision))||
  !Number.isSafeInteger(body.expectedOriginalTotalCents)||!Number.isSafeInteger(body.expectedProposedTotalCents))
  return json({error:'Review the booking date, exact quote amounts, and internal note.'},400);
 try{
  const checked=await verifiedPreview(id,body.bookingConfirmedOn);
  if(!checked.preview)return json({error:checked.reason},409);
  const p=checked.preview;
  if(p.current.totalCents!==body.expectedOriginalTotalCents||p.proposed.totalCents!==body.expectedProposedTotalCents)
   return json({error:'The quoted amounts changed. Refresh the calculation before saving an internal review.'},409);
  const scopeHash=await estimateScopeFingerprint(id);
  const stored=await read(id);
  const note=body.ownerNote.trim();
  // Retrying a committed-but-lost response must never create another review revision.
  if(stored.draft&&stored.draft.bookingConfirmedOn===p.bookingConfirmedOn&&
    stored.draft.originalTotalCents===p.current.totalCents&&stored.draft.proposedTotalCents===p.proposed.totalCents&&
    stored.draft.ownerNote===note&&stored.draft.catalogRevision===p.originalCatalogRevision&&
    stored.draft.originalScopeSha256===scopeHash&&
    stored.draft.originalStatus===p.status&&
    stored.draft.customerAlreadyAccepted===p.customerAlreadyAccepted&&
    stored.draft.hasFinancialActivity===p.hasFinancialActivity&&
    stored.draft.originalDepositCents===p.current.depositCents&&
    stored.draft.proposedDepositCents===p.proposed.depositCents&&
    JSON.stringify(stored.draft.newRules)===JSON.stringify(p.newlyEligible))
   return json({draft:stored.draft,revision:stored.draft.revision,confirmed:true,alreadySaved:true});
  if((stored.draft?.revision??null)!==body.expectedRevision)
   return json({error:'Another device changed this internal review. Refresh before replacing it.'},409);
  const savedOn=new Date().toISOString();
  const draft:BookingReviewDraft={format:'fire-booking-review-v1',estimateId:id,revision:crypto.randomUUID(),
   bookingConfirmedOn:p.bookingConfirmedOn,ownerNote:note,originalScopeSha256:scopeHash,savedOn,catalogRevision:p.originalCatalogRevision,
   originalStatus:p.status,customerAlreadyAccepted:p.customerAlreadyAccepted,hasFinancialActivity:p.hasFinancialActivity,
   originalTotalCents:p.current.totalCents,originalDepositCents:p.current.depositCents,
   proposedTotalCents:p.proposed.totalCents,proposedDepositCents:p.proposed.depositCents,
   possibleSavingsCents:p.possibleSavingsCents,newRules:p.newlyEligible};
  const value=JSON.stringify(draft),key=BOOKING_REVIEW_DRAFT_PREFIX+id;
  const commit=stored.body===null?
   await env.DB.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,?) ON CONFLICT(key) DO NOTHING").bind(key,value,savedOn).run():
   await env.DB.prepare('UPDATE message_templates SET body=?,updated_at=? WHERE key=? AND body=?').bind(value,savedOn,key,stored.body).run();
  if(commit.meta.changes!==1)return json({error:'Another device saved a review first. Refresh the internal draft.'},409);
  return json({draft,revision:draft.revision,confirmed:true,alreadySaved:false});
 }catch{return json({error:'Internal review save could not be confirmed. Read back before trying again.'},503);}
}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!await authorized())return json({error:'Unauthorized'},401);
 const {id}=await params;
 let body:unknown;
 try{body=await request.json();}catch{return json({error:'Provide the current draft revision.'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).join(',')!=='expectedRevision'||
  typeof (body as {expectedRevision?:unknown}).expectedRevision!=='string'||
  !uuid.test((body as {expectedRevision:string}).expectedRevision))return json({error:'Provide the current draft revision.'},400);
 try{
  const saved=await read(id);
  if(!saved.draft)return json({error:'The internal review is already absent. Refresh before continuing.'},409);
  if(saved.draft.revision!==(body as {expectedRevision:string}).expectedRevision)
   return json({error:'This internal draft changed on another device. Refresh before discarding.'},409);
  const result=await env.DB.prepare('DELETE FROM message_templates WHERE key=? AND body=?').bind(BOOKING_REVIEW_DRAFT_PREFIX+id,saved.body).run();
  if(result.meta.changes!==1)return json({error:'Concurrent draft change detected. Refresh.'},409);
  return json({discarded:true,estimateId:id});
 }catch{return json({error:'Internal draft removal could not be confirmed. Refresh before retrying.'},503);}
}
