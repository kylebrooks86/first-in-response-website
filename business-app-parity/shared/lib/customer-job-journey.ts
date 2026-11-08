/** Source-backed customer journey. Display only, never an outbound action or ledger write. */
export type JourneyJob={id:string;service?:string|null;createdAt:string;status:string;firstEstimateSentAt?:string|null;lastEstimateSentAt?:string|null;firstViewedAt?:string|null;acceptedAt?:string|null;depositCents:number;paidCents:number;scheduledAt?:string|null;paymentOverageOpen?:number|null;pendingRefundCount?:number|null;openCheckoutCount?:number|null};
export type JourneyMessage={estimateId?:string|null;template:string;channel:string;createdAt:string};
export type JourneyStep={key:"sent"|"viewed"|"followup"|"approved"|"deposit"|"scheduled";title:string;state:"done"|"pending"|"verify";detail:string;at:string|null};
const validDate=(value?:string|null)=>typeof value==="string"&&Number.isFinite(Date.parse(value))?value:null;
const sent=(channel:string)=>channel==="text_confirmed"||channel==="email_confirmed";
export function customerJobJourney(job:JourneyJob,messages:readonly JourneyMessage[]):{headline:string;steps:JourneyStep[]}{
 const events=messages.filter(m=>m.estimateId===job.id&&validDate(m.createdAt));
 const confirmedEstimate=events.filter(m=>m.template==="estimate"&&sent(m.channel)).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
 const sendAt=confirmedEstimate[0]?.createdAt??validDate(job.firstEstimateSentAt);
 const viewAt=validDate(job.firstViewedAt);
 const confirmedFollowups=events.filter(m=>["followUp1","followUp3","followUp7"].includes(m.template)&&sent(m.channel)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
 const manual=events.filter(m=>m.channel==="contact_recorded").sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
 const acceptedAt=validDate(job.acceptedAt);
 const approved=["approved","scheduled","completed"].includes(job.status);
 const amountSafe=Number.isSafeInteger(job.depositCents)&&job.depositCents>=0&&Number.isSafeInteger(job.paidCents)&&job.paidCents>=0;
 const billingSafe=amountSafe&&job.paymentOverageOpen===0&&job.pendingRefundCount===0&&job.openCheckoutCount===0;
 const depositCovered=billingSafe&&job.depositCents>0&&job.paidCents>=job.depositCents;
 const scheduledAt=validDate(job.scheduledAt);
 const scheduled=scheduledAt!==null&&["scheduled","completed"].includes(job.status);
 const steps:JourneyStep[]=[
 {key:"sent",title:"Estimate sent",state:sendAt?"done":job.status==="sent"?"verify":"pending",at:sendAt,detail:sendAt?"Owner-confirmed send recorded · delivery unverified":job.status==="sent"?"Marked sent · no confirmed send receipt":"No confirmed send recorded"},
 {key:"viewed",title:"Estimate viewed",state:viewAt?"done":"pending",at:viewAt,detail:viewAt?"Link opened · viewer identity and intent unverified":"No recorded link view"},
 {key:"followup",title:"Follow-up sent",state:confirmedFollowups.length?"done":manual.length?"verify":"pending",at:confirmedFollowups[0]?.createdAt??manual[0]?.createdAt??null,detail:confirmedFollowups.length?"Owner-confirmed follow-up send · delivery unverified":manual.length?"Contact logged · no confirmed send":"No confirmed follow-up"},
 {key:"approved",title:"Approved",state:acceptedAt||approved?"done":job.status==="declined"?"verify":"pending",at:acceptedAt,detail:acceptedAt?"Acceptance recorded":approved?"Approved in saved status · acceptance receipt not available":job.status==="declined"?"Declined status recorded":"Approval not recorded"},
 {key:"deposit",title:"Deposit covered",state:depositCovered?"done":billingSafe?"pending":"verify",at:null,detail:!amountSafe?"Payment amounts need verification":Number(job.paymentOverageOpen)>0||Number(job.pendingRefundCount)>0||Number(job.openCheckoutCount)>0?"Payment, refund, or checkout issue requires review":!billingSafe?"Payment evidence unavailable":job.depositCents===0?"No required deposit set":depositCovered?"Saved paid principal covers deposit · not a separate deposit receipt":"Deposit not yet covered by saved paid principal"},
 {key:"scheduled",title:"Job scheduled",state:scheduled?"done":scheduledAt?"verify":"pending",at:scheduled?scheduledAt:null,detail:scheduled?"Schedule recorded":scheduledAt?"Date exists · scheduling status unconfirmed":"No saved scheduled job"}
 ];
 const headline=job.status==="declined"?"Declined · review saved record":scheduled?"Job scheduled":acceptedAt||approved?(depositCovered?"Approved · deposit covered":"Approved · check deposit"):viewAt&&job.status==="sent"?"Viewed · awaiting approval":sendAt?"Estimate sent · awaiting response":job.status==="draft"?"Draft estimate":"Review job status";
 return {headline,steps};
}
