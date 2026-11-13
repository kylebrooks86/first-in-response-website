/** Classify only OPEN tasks into mutually exclusive due-time buckets in the owner's local timezone. */
export type TaskDueBucket="overdue"|"today"|"later"|"none";

export function taskDueBucket(task:{status:string;dueAt?:string|null},now:Date):TaskDueBucket{
  if(task.status!=="open"||typeof task.dueAt!=="string"||!task.dueAt.trim())return "none";
  const due=Date.parse(task.dueAt),nowMs=now.getTime();
  if(!Number.isFinite(due)||!Number.isFinite(nowMs))return "none";
  if(due<nowMs)return "overdue";
  // Local calendar midnight, rather than adding 24 hours: DST days can be 23 or 25 hours.
  const nextMidnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime();
  return due<nextMidnight?"today":"later";
}
