/** Convert a user-selected expense calendar date to a stable ISO timestamp.
 * Noon UTC preserves the selected date in CSV exports and in US local-time views.
 * Return null for malformed or impossible calendar dates; never silently roll forward.
 */
export function expenseDateInstant(date:string):string|null{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
  const instant=new Date(date+"T12:00:00.000Z");
  if(!Number.isFinite(instant.getTime())||instant.toISOString().slice(0,10)!==date)return null;
  return instant.toISOString();
}

/** Treat FIRE purchases as Tulsa business-calendar days, not UTC calendar
 * days or the timezone of a phone traveling outside Oklahoma.
 * Exact selected dates (legacy date-only records) remain literal dates.
 * Invalid/ambiguous timestamps have no silently invented tax year.
 */
export function expenseBusinessDay(incurredAt:string):string|null{
  if(typeof incurredAt!=='string'||!incurredAt)return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(incurredAt))
    return expenseDateInstant(incurredAt)?incurredAt:null;
  if(!/^\d{4}-\d{2}-\d{2}T/.test(incurredAt)||!/([Zz]|[+-]\d{2}:\d{2})$/.test(incurredAt))return null;
  const instant=new Date(incurredAt);
  if(!Number.isFinite(instant.getTime()))return null;
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(instant);
  const part=(type:string)=>parts.find(item=>item.type===type)?.value??'';
  const day=`${part('year')}-${part('month')}-${part('day')}`;
  return expenseDateInstant(day)?day:null;
}
