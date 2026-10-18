import assert from 'node:assert/strict';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
const {completeEstimatePages}=createRouteFixtureLoader(process.cwd(),{},()=>null)('lib/estimate-pagination.ts');
let checks=0;const eq=(actual,expected)=>{assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);checks++;};
const response=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
const row=id=>({id,totalCents:20000,depositCents:10000,paidCents:0,status:'scheduled'});
const page=(ids,nextCursor=null)=>({estimates:ids.map(row),nextCursor});
let reads=[];
const all=await completeEstimatePages(page(['a'],'opaque +/cursor'),async url=>{reads.push(url);return response(page(['b']));});
eq(all.map(r=>r.id),['a','b']);eq(reads,['/api/estimate-history?limit=50&cursor=opaque%20%2B%2Fcursor']);
for(const invalid of [{estimates:[]},{estimates:[],nextCursor:'loop'},{estimates:{},nextCursor:null},{estimates:[{}],nextCursor:null},page(['same','same']),page(['x'],42),page(['x'],'x'.repeat(513)),page(Array.from({length:51},(_,i)=>String(i)))]){
 await assert.rejects(()=>completeEstimatePages(invalid,()=>{throw Error('Unexpected fetch');}));checks++;
}
for(const next of [page(['b'],'loop'),page(['a']),{error:'Denied'},{estimates:[],nextCursor:'second'}]){
 const initial=next.nextCursor==='loop'?page(['a'],'loop'):page(['a'],'first');
 await assert.rejects(()=>completeEstimatePages(initial,async()=>response(next)));checks++;
}
await assert.rejects(()=>completeEstimatePages(page(['a'],'first'),async()=>new Response(JSON.stringify({error:'Page access denied'}),{status:403})),/Page access denied/);checks++;
await assert.rejects(()=>completeEstimatePages(page(['a'],'first'),async()=>{throw Error('Offline');}),/Offline/);checks++;
await assert.rejects(()=>completeEstimatePages(page(['a'],'first'),async()=>new Response('broken JSON')));checks++;
let current=true;
eq(await completeEstimatePages(page(['a'],'first'),async()=>{current=false;return response(page(['b']));},()=>current),null);
eq(await completeEstimatePages(page(['a'],'first'),async()=>{throw Error('Stale request fetched');},()=>false),null);
const thousands=await completeEstimatePages(page(Array.from({length:50},(_,i)=>'id-'+i),'50'),async url=>{const offset=Number(new URL(url,'https://local.invalid').searchParams.get('cursor'));return response(page(Array.from({length:50},(_,i)=>'id-'+(offset+i)),offset===200?null:String(offset+50)));});eq(thousands.length,250);eq(new Set(thousands.map(r=>r.id)).size,250);
console.log(`PASS ${checks}/${checks}: shared all-page reader, bounded pages, encoded same-origin cursor, duplicate/partial/malformed/error refusal, stale cancellation and 250 complete records. Read-only synthetic fixtures.`);
