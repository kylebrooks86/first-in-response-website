/** Read all bounded pages before publishing an estimate collection to the UI.
 * Read-only: never retries writes or accepts a server-provided URL.
 */
export async function completeEstimatePages<T extends {id:string}>(first:{estimates?:T[];nextCursor?:unknown},fetchPage:(url:string)=>Promise<Response>,isCurrent:()=>boolean=()=>true):Promise<T[]|null>{
  const rows:T[]=[],ids=new Set<string>(),cursors=new Set<string>();
  let page=first;
  for(let index=0;index<1000;index++){
    if(!isCurrent())return null;
    if(!Array.isArray(page.estimates)||page.estimates.length>50||page.estimates.some(row=>!row||typeof row.id!=='string'||!row.id))throw Error('Estimate records could not be read. Refresh before using totals.');
    for(const row of page.estimates){if(ids.has(row.id))throw Error('Estimates changed while loading. Refresh before using totals.');ids.add(row.id);rows.push(row);}
    const cursor=page.nextCursor;
    if(cursor===null)return rows;
    if(typeof cursor!=='string'||!cursor||cursor.length>512||!page.estimates.length||cursors.has(cursor))throw Error('Estimate paging did not advance. Refresh before using totals.');
    cursors.add(cursor);
    const response=await fetchPage('/api/estimate-history?limit=50&cursor='+encodeURIComponent(cursor));
    if(!isCurrent())return null;
    const result=await response.json() as {estimates?:T[];nextCursor?:unknown;error?:string}|null;
    if(!response.ok)throw Error(result?.error||'The complete estimate list could not be loaded. Refresh before using totals.');
    if(!result||typeof result!=="object"||Array.isArray(result))throw Error('Estimate page could not be read. Refresh before using totals.');
    page=result;
  }
  throw Error('The estimate list exceeds the safe loading limit. Totals are unavailable.');
}
