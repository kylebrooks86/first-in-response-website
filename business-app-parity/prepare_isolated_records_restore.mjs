/** FIRE isolated records recovery artifact generator (local, no provider calls).
 * Reads a complete numbered records archive and an isolated destination's
 * separately captured schema/empty-count inventory. Produces a private SQL
 * file ONLY; never runs it. Do not use on QA, STAGING or LIVE databases.
 *
 * node prepare_isolated_records_restore.mjs RECORDS.json ISOLATED_SCHEMA.json OUTPUT.sql
 * Inventory JSON: {"schemaColumns":{"customers":["id",...]}, "emptyTableCounts":{"customers":0,...}}
 */
import {readFile,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileEmptyIsolatedNumberedRestore} from './compile_isolated_numbered_records_restore.mjs';
const fail=why=>{throw Error('FIRE isolated SQL preparation BLOCKED: '+why);};
export async function prepareIsolatedRecordsRestore(recordsPath,inventoryPath,outputPath){
 if([recordsPath,inventoryPath,outputPath].some(x=>typeof x!=='string'||!x)||
    new Set([recordsPath,inventoryPath,outputPath].map(p=>resolve(p))).size!==3)
  fail('three separate source/inventory/output files required');
 let records,inventory;
 try{
  records=JSON.parse(await readFile(resolve(recordsPath),'utf8'));
  inventory=JSON.parse(await readFile(resolve(inventoryPath),'utf8'));
 }catch{fail('records or schema inventory cannot be read');}
 if(!inventory||Object.keys(inventory).sort().join(',')!=='emptyTableCounts,schemaColumns')
  fail('exact isolated schema and zero-count inventory required');
 const result=compileEmptyIsolatedNumberedRestore(records,inventory.schemaColumns,inventory.emptyTableCounts);
 let handle;
 try{
  handle=await open(resolve(outputPath),'wx',0o600);
  await handle.writeFile(result.sql,'utf8');
  await handle.sync();
  await handle.close();handle=undefined;
 }catch(error){
  if(handle){await handle.close().catch(()=>{});await unlink(resolve(outputPath)).catch(()=>{});}
  fail(error?.code==='EEXIST'?'SQL output already exists':'private SQL output could not be saved');
 }
 return Object.freeze({
  outputWritten:true,sourceRows:result.sourceRows,customers:result.customers,
  jobNumbers:result.jobNumbers,sqlExecuted:false,providerWriteAttempted:false,
  isolatedRestoreVerified:false,gate7Accepted:false
 });
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 try{
  if(process.argv.length!==5)
   fail('usage: node prepare_isolated_records_restore.mjs RECORDS.json ISOLATED_SCHEMA.json OUTPUT.sql');
  console.log(JSON.stringify(await prepareIsolatedRecordsRestore(...process.argv.slice(2))));
 }catch(error){console.error(error instanceof Error?error.message:'restore preparation failed');process.exitCode=1;}
}
