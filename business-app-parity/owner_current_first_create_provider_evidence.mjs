/**
 * FIRE one-shot owner first-create: parse only structured READ-ONLY Wrangler
 * evidence. Never promote a diagnostic substring into proof of owner
 * membership, physical D1 isolation or hosted Worker existence.
 * This module makes NO network, Cloudflare, Stripe or filesystem calls.
 */
const stop=why=>{throw Error('FIRE OWNER FIRST-CREATE EVIDENCE BLOCKED: '+why)};
const validID=s=>typeof s==='string'&&/^[a-f0-9]{32}$/i.test(s);
const validUUID=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
function parseJsonResult(reply,context){
 if(!reply||reply.code!==0||typeof reply.stdout!=='string')
  stop(context+' read-only command did not succeed');
 let result;
 try{result=JSON.parse(reply.stdout.trim());}catch{stop(context+' command stdout is not standalone JSON');}
 if(result===null||typeof result!=='object')
  stop(context+' JSON is not an object');
 return result;
}
export function verifyOwnerAccountReadback(reply,expectedAccountID){
 if(!validID(expectedAccountID))stop('expected account ID is invalid');
 const answer=parseJsonResult(reply,'whoami');
 if(Array.isArray(answer)||answer.loggedIn!==true||!Array.isArray(answer.accounts))
  stop('whoami did not confirm signed-in JSON account membership');
 const ids=answer.accounts.map(x=>x&&typeof x==='object'&&!Array.isArray(x)?x.id:null);
 if(ids.some(x=>x!==null&&!validID(x))||ids.filter(x=>x===expectedAccountID).length!==1)
  stop('whoami authenticated membership excludes the exact reviewed account');
 return Object.freeze({ownerMembershipConfirmed:true,accountId:expectedAccountID});
}
export function verifyPhysicalD1InfoReadback(reply,expectedName,expectedUUID){
 if(!validUUID(expectedUUID)||typeof expectedName!=='string'||!expectedName)
  stop('expected physical database identity invalid');
 const answer=parseJsonResult(reply,'D1 info');
 if(Array.isArray(answer))stop('D1 info must identify exactly one object');
 if(typeof answer.name==='string'&&answer.name!==expectedName)
  stop('D1 info returned a different database name');
 const values=['uuid','database_id','id'].filter(k=>Object.hasOwn(answer,k)&&answer[k]!=null)
  .map(k=>answer[k]);
 if(!values.length||values.some(x=>x!==expectedUUID))
  stop('D1 read-only UUID does not exactly match approved physical database');
 return Object.freeze({physicalD1Confirmed:true,databaseName:expectedName,databaseUUID:expectedUUID});
}
export function verifyNewWorkerAbsentReadback(reply){
 // An unrelated 10007, a missing local file, or text mixed between stdout
 // and stderr must NEVER turn a failed read into permission to first-create.
 if(!reply||!Number.isInteger(reply.code)||reply.code===0||
    typeof reply.stderr!=='string'||typeof reply.stdout!=='string'||
    reply.stdout.trim()!=='')
  stop('worker absence requires a failed read-only listing with stderr-only evidence');
 const diagnostic=reply.stderr.replace(/\x1b\[[0-9;]*m/g,'').trim();
 if(!diagnostic||diagnostic.length>4096||
    (diagnostic.match(/\b10007\b/g)||[]).length!==1||
    /\b(?:unauthorized|unauthenticated|forbidden|permission denied|access denied|invalid credentials|expired token)\b/i.test(diagnostic))
  stop('worker absence has missing, mixed, or contradictory provider diagnostics');
 // Require the absent WORKER/SCRIPT/SERVICE indication to belong to the
 // 10007 diagnostic, not a separate "not found" line elsewhere in the log.
 const at=diagnostic.search(/\b10007\b/);
 const region=diagnostic.slice(Math.max(0,at-180),Math.min(diagnostic.length,at+180));
 if(!/(?:\bworker\b|\bscript\b|\bservice\b)[^\r\n]{0,90}\b(?:does not exist|not found)\b/i.test(region)&&
    !/\b(?:does not exist|not found)\b[^\r\n]{0,90}(?:\bworker\b|\bscript\b|\bservice\b)/i.test(region)||
    /\b(?:error|code)\s*[:=#-]?\s*(?!10007\b)\d{4,6}\b/i.test(diagnostic))
  stop('worker is not conclusively absent: wrong or unrelated provider error');
 return Object.freeze({exactWorkerAbsenceReported:true,onlyFirstCreateAllowed:true});
}
export function verifyCreatedWorkerListReadback(reply){
 const response=parseJsonResult(reply,'post-create Worker versions list');
 const records=Array.isArray(response)?response:
  Array.isArray(response.versions)?response.versions:
  Array.isArray(response.items)?response.items:null;
 if(!records||!records.length)
  stop('hosted version list empty or unexpected; creation outcome not attested');
 const ids=records.map(x=>x&&typeof x==='object'?
   (x.id||x.version_id||x.versionId):null);
 if(ids.some(id=>!validUUID(id)))
  stop('hosted version identity missing or malformed');
 return Object.freeze({hostedVersionListReadback:true,versionCount:ids.length,
  hostedPhysicalBindingVerified:false,ownerLoginVerified:false,
  gate4Accepted:false,liveReleaseAccepted:false});
}
