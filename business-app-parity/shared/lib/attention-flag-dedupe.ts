/** Read-only linking between manual customer flags and existing saved Business tasks.
 * A due task hides duplicate bell flags only when the exact event marker matches.
 * Completed and future tasks never suppress a customer flag that still needs review.
 */
export type FlagTaskEvidence={id:string;customerId?:string|null;status:string;notes?:string|null};
export function flagHasMatchingDueTask(
 tasks:readonly FlagTaskEvidence[],dueTaskIds:ReadonlySet<string>,customerId:string,event:"sign"|"review",eventAt:string
):boolean{
 if(!customerId||!eventAt||!Number.isFinite(Date.parse(eventAt)))return false;
 const marker=event==="sign"?"FIRE yard sign placement: ":"FIRE review request: ";
 return tasks.some(task=>task?.status==="open"&&task.customerId===customerId&&
   typeof task.id==="string"&&dueTaskIds.has(task.id)&&
   typeof task.notes==="string"&&task.notes.includes(marker+eventAt));
}
