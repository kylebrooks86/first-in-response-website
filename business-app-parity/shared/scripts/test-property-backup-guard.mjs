import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=mkdtempSync(join(tmpdir(),'fire-property-file-guard-'));
let passed=0;
try{
 for(const table of ['customer_properties','estimate_property_links','manifest-only','declaration-only'])for(const format of ['app','snapshot']){
  const payload=format==='app'?{format:'fire-app-records-backup',version:1,tables:{[table]:[]}}:{backup_format:'FIRE App live database snapshot',format_version:1,verification:{all_tables_complete:true,truncated:false},tables:{[table]:{rows:[]}}};
  if(table==='manifest-only'||table==='declaration-only'){delete payload.tables[table];if(table==='manifest-only')payload.customerProperties={version:1,propertyIds:[],estimateIds:[]};else payload.includes={customerProperties:false};}
  const file=join(root,'synthetic.json');writeFileSync(file,JSON.stringify(payload));
  const result=spawnSync(process.execPath,[new URL('./validate-records-backup.mjs',import.meta.url).pathname,file],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Property-aware backup is not verified/);passed++;console.log('PASS: '+format+' '+table+' rejects before legacy validation/apply');
 }
 console.log(`PASS ${passed}/${passed} property backup file guards; no database or provider calls`);
}finally{rmSync(root,{recursive:true,force:true});}
