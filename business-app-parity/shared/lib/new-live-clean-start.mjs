/**
 * Owner-opt-in NEW LIVE startup protection. No writes or remote calls.
 * A clean prelaunch database may contain schema, preferences and templates,
 * but must never inherit QA jobs or permanent Job # serials. Legitimate\n * new-LIVE customers may be created before their first estimate.
 */
export const NEW_LIVE_CLEAN_START_FLAG='required';
const integer=x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
export function assertNewLiveFirstJobState(row){
  if(!row||!['customers','estimates','numberedCustomers','numberedJobs','jobLinks','customerSequence','jobSequence'].every(k=>integer(row[k])))
    throw Error('NEW LIVE source identity or serial history cannot be verified.');
  if(row.estimates===0&&
    (row.numberedJobs!==0||row.jobLinks!==0||row.jobSequence!==0))
    throw Error('NEW LIVE is not a clean first-job database; preserve existing data and stop.');
  if(row.customers!==row.numberedCustomers||
     row.customerSequence<row.numberedCustomers)
    throw Error('NEW LIVE customer identity coverage is inconsistent.');
  if(row.estimates>0&&row.numberedJobs===0)
    throw Error('NEW LIVE permanent Job # history is missing.');
  if(row.numberedJobs>0&&row.jobSequence<row.numberedJobs)
    throw Error('NEW LIVE permanent Job # high-water is inconsistent.');
  return true;
}
export async function verifyNewLiveFirstJobState(db){
  const row=await db.prepare(`SELECT
    (SELECT COUNT(*) FROM customers) AS customers,
    (SELECT COUNT(*) FROM estimates) AS estimates,
    (SELECT COUNT(*) FROM fire_customer_numbers) AS numberedCustomers,
    (SELECT COUNT(*) FROM fire_job_numbers) AS numberedJobs,
    (SELECT COUNT(*) FROM fire_job_estimate_links) AS jobLinks,
    COALESCE((SELECT seq FROM sqlite_sequence WHERE name='fire_customer_numbers'),0) AS customerSequence,
    COALESCE((SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers'),0) AS jobSequence`).first();
  return assertNewLiveFirstJobState(row);
}
