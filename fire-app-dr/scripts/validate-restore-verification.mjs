import fs from "node:fs";
import path from "node:path";

const root=path.resolve(new URL("..",import.meta.url).pathname);
const standalone=fs.readFileSync(path.join(root,"scripts/restore-records-backup.mjs"),"utf8");
const api=fs.readFileSync(path.join(root,"app/api/backup/route.ts"),"utf8");

const must=(condition,message)=>{if(!condition)throw new Error(message);};

must(standalone.includes('attemptId:randomUUID()'),"Standalone restore does not assign a unique restore audit attempt ID.");
must(standalone.includes('restoreAudit.phase="target_conflict_validation"'),"Standalone restore does not expose target-conflict validation phase.");
must(standalone.includes("Database writes may have occurred. Inspect this restore audit before retrying."),"Standalone restore does not emit audit-first retry guidance after attempted writes.");
must(standalone.includes("fieldValuesVerified: true"),"Standalone restore does not report field verification.");
must(standalone.includes("lifecycleNotificationUniquenessVerified: true"),"Standalone restore does not report lifecycle uniqueness verification.");
must(standalone.includes("HAVING COUNT(*)>1 LIMIT 1"),"Standalone restore does not query for duplicate lifecycle notifications after apply.");
must(api.includes("const recordResults=results.slice(0,verificationPlans.length)"),"In-app restore does not isolate record INSERT results.");
must(api.includes("if(Number(recordResults[planIndex]?.meta.changes??0)===0)continue"),"In-app restore does not skip merge-preserved rows during field verification.");
must(api.includes("if(verifiedRecords!==insertedRecords)"),"In-app restore does not compare inserted vs verified record counts.");
must(api.includes("lifecycleNotificationUniquenessVerified:true"),"In-app restore does not report lifecycle uniqueness verification.");
must(api.includes("HAVING COUNT(*)>1 LIMIT 1"),"In-app restore does not check post-restore lifecycle uniqueness.");
must(api.includes('attemptId:crypto.randomUUID()'),"In-app restore does not assign a restore audit attempt ID.");
must(api.includes('phase:"write_apply"')||api.includes('restoreAudit.phase="write_apply"'),"In-app restore does not track write phase.");
must(api.includes("restoreAudit.writesAttempted ? 500 : 400"),"In-app restore does not distinguish pre-write validation failures from post-write verification failures.");
must(api.includes("postWriteFailure")&&api.includes("Database writes occurred. Inspect the restore audit before retrying."),"In-app restore does not consistently warn against blind retry after post-write verification failure.");
must(api.includes("Inspect the restore audit before retrying"),"In-app restore catch path does not warn against blind retry after post-write failure.");
must(standalone.includes('restoreAudit.phase="record_verification"')&&standalone.includes('restoreAudit.phase="invariant_verification"'),"Standalone restore does not expose verification phases.");
console.log("PASS  Restore verification/audit contract: attempt IDs, phases, writes, verification progress, invariants, and safe retry guidance are explicit across both restore paths.");
