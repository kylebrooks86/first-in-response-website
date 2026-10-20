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
