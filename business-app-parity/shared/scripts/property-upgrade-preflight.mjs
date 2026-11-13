import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha=value=>createHash('sha256').update(value).digest('hex');
const canonical=sql=>String(sql??'').trim().replace(/;$/,'');
const extensionTables=['estimate_service_locations','customer_properties','estimate_property_links','property_recovery_guard'];
const internal=name=>name.startsWith('sqlite_')||name.startsWith('_cf_')||name==='d1_migrations';
export function loadPropertyUpgrade(root,manifestPath,target){
 if(!['live','doomsday','staging'].includes(target))throw Error('Select an explicit known target.');
 const manifest=JSON.parse(readFileSync(manifestPath,'utf8')),plan=manifest.targets?.[target];
 if(manifest.format!=='fire-property-upgrade-review'||manifest.version!==1||manifest.executionAuthorized!==false||manifest.productionReady!==false||!plan||plan.existingJournalModified!==false||plan.historicalBackfill!==false)throw Error('Invalid review-only migration manifest.');
 const files=readdirSync(join(root,'drizzle')).filter(name=>/^\d{4}_.+\.sql$/.test(name)).sort();
 if(files.join(',')!==plan.baseline.map(file=>file.name).join(','))throw Error('Target migration history differs from the pinned package.');
 for(const file of plan.baseline)if(sha(readFileSync(join(root,'drizzle',file.name)))!==file.sha256)throw Error('Historical migration checksum differs: '+file.name);
 const base=dirname(resolve(manifestPath));
 const planned=plan.planned.map(file=>{
  if(file.path!==target+'/'+file.name||!/^\d{4}_[a-z_]+\.sql$/.test(file.name))throw Error('Unsafe planned migration path.');
  const bytes=readFileSync(join(base,file.path));if(sha(bytes)!==file.sha256||bytes.length!==file.bytes)throw Error('Planned migration checksum differs: '+file.name);
  return {...file,sql:bytes.toString('utf8')};
 });
 if(planned.length!==2||planned.some((file,i)=>Number(file.name.slice(0,4))!==files.length+i))throw Error('Unexpected pending migration sequence.');
 const db=new DatabaseSync(':memory:');
 try{
  for(const name of files)db.exec(readFileSync(join(root,'drizzle',name),'utf8'));
  const baselineSchema=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index','trigger','view') ORDER BY type,name").all().filter(row=>!internal(row.name));
  for(const file of planned)db.exec(file.sql);
  const upgradedSchema=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index','trigger','view') ORDER BY type,name").all().filter(row=>!internal(row.name));
  return {target,manifest,plan,planned,baselineSchema,upgradedSchema,baselineNames:files,upgradedNames:[...files,...planned.map(file=>file.name)]};
 }finally{db.close();}
}
// get(sql) and all(sql) are read-only caller adapters. This function never opens a provider connection.
export async function capturePropertyUpgradeMetadata(reader,root){
 const schema=await reader.all("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index','trigger','view') ORDER BY type,name");
 const tables=new Set(schema.filter(row=>row.type==='table').map(row=>row.name));
 const journal=tables.has('d1_migrations')?await reader.all('SELECT name FROM d1_migrations ORDER BY name'):null;
 const extensionCounts={};for(const table of extensionTables)extensionCounts[table]=tables.has(table)?Number((await reader.get(`SELECT COUNT(*) AS count FROM ${table}`)).count):null;
 const financialStatements=readFileSync(new URL('./stripe-ledger-preflight.sql',import.meta.url),'utf8').replace(/--[^\n]*/g,'').split(';').map(sql=>sql.trim()).filter(Boolean);
 const financialCounts=[];for(const sql of financialStatements){if(!/^SELECT\s/i.test(sql))throw Error('Expected read-only financial query.');try{financialCounts.push(Number((await reader.get(`SELECT COUNT(*) AS count FROM (${sql})`)).count));}catch{financialCounts.push(null);}}
 let propertyAnomalies=null;
 if(extensionTables.every(table=>tables.has(table))){
  const queries=[
   "SELECT COUNT(*) AS count FROM customer_properties p LEFT JOIN customers c ON c.id=p.customer_id WHERE c.id IS NULL OR length(trim(p.address)) NOT BETWEEN 1 AND 2000 OR length(p.designation)>200 OR NOT ((p.active=1 AND p.revision=1) OR (p.active=0 AND p.revision=2)) OR julianday(p.created_at) IS NULL",
   "SELECT COUNT(*) AS count FROM estimate_service_locations sl LEFT JOIN estimates e ON e.id=sl.estimate_id WHERE e.id IS NULL OR e.customer_id<>sl.customer_id OR length(trim(sl.address)) NOT BETWEEN 1 AND 2000 OR julianday(sl.captured_at) IS NULL",
   "SELECT COUNT(*) AS count FROM estimate_property_links pl LEFT JOIN estimates e ON e.id=pl.estimate_id LEFT JOIN customer_properties p ON p.id=pl.property_id LEFT JOIN estimate_service_locations sl ON sl.estimate_id=pl.estimate_id WHERE e.id IS NULL OR p.id IS NULL OR sl.estimate_id IS NULL OR e.customer_id<>pl.customer_id OR p.customer_id<>pl.customer_id OR sl.customer_id<>pl.customer_id OR sl.address<>p.address||CASE WHEN p.designation<>'' THEN ' · '||p.designation ELSE '' END OR sl.captured_at<>pl.captured_at OR pl.selection_mode NOT IN ('sole','explicit') OR pl.property_revision<>1 OR pl.captured_at<p.created_at OR julianday(pl.captured_at) IS NULL",
  ];
  propertyAnomalies=[];for(const sql of queries){try{propertyAnomalies.push(Number((await reader.get(sql)).count));}catch{propertyAnomalies.push(null);}}
 }
 return {schema:schema.filter(row=>!internal(row.name)),journal,extensionCounts,financialCounts,propertyAnomalies,foreignKeyViolations:Number((await reader.get('SELECT COUNT(*) AS count FROM pragma_foreign_key_check')).count),foreignKeysEnabled:Number((await reader.get('PRAGMA foreign_keys')).foreign_keys)===1};
}
export function evaluatePropertyUpgrade(metadata,packageData){
 const {baselineSchema,upgradedSchema,baselineNames,upgradedNames,target}=packageData;
 const actual=new Map(metadata.schema.map(row=>[row.type+':'+row.name,row]));
 const extension=upgradedSchema.filter(row=>!baselineSchema.some(base=>base.type===row.type&&base.name===row.name));
 const present=extension.filter(row=>actual.has(row.type+':'+row.name)).length;
 const state=present===0?'absent':present===extension.length?'complete':'partial';
 const expected=state==='absent'?baselineSchema:upgradedSchema;
 const differences=[];
 for(const row of expected){const found=actual.get(row.type+':'+row.name);if(!found||canonical(found.sql)!==canonical(row.sql)||found.tbl_name!==row.tbl_name)differences.push(row.type+':'+row.name);}
 for(const row of metadata.schema)if(!expected.some(item=>item.type===row.type&&item.name===row.name))differences.push('unexpected:'+row.type+':'+row.name);
 const journalNames=metadata.journal?.map(row=>row.name),expectedJournal=state==='absent'?baselineNames:upgradedNames;
 const journalCompatible=Array.isArray(journalNames)&&new Set(journalNames).size===journalNames.length&&journalNames.length===expectedJournal.length&&expectedJournal.every(name=>journalNames.includes(name));
 const financialClear=metadata.financialCounts.length===4&&metadata.financialCounts.every(count=>count===0);
 const propertyClear=state==='absent'||metadata.propertyAnomalies?.length===3&&metadata.propertyAnomalies.every(count=>count===0)&&metadata.extensionCounts.property_recovery_guard===0;
 const clear=state!=='partial'&&differences.length===0&&journalCompatible&&financialClear&&propertyClear&&metadata.foreignKeyViolations===0&&metadata.foreignKeysEnabled;
 return {target,propertySchemaState:state,schemaDefinitionsCompatible:differences.length===0,schemaDifferences:differences,journalCompatible,financialClear,propertyClear,foreignKeyViolations:metadata.foreignKeyViolations,foreignKeysEnabled:metadata.foreignKeysEnabled,extensionRecordCounts:metadata.extensionCounts,
  eligibleForSeparatelyApprovedUpgrade:clear&&state==='absent',candidatePropertySchemaReady:clear&&state==='complete',legacyAppRollbackCompatible:clear&&(state==='absent'||extensionTables.every(table=>metadata.extensionCounts[table]===0)),schemaRemovalAuthorized:false,
  pendingMigrationNames:state==='absent'?packageData.planned.map(file=>file.name):[],remoteVerified:false,productionReady:false,executionAuthorized:false,scope:'read-only exact schema/journal/count preflight; resource identity and release approval remain separate'};
}
export async function inspectPropertyUpgradeFile(filename,root,manifestPath,target){
 const packageData=loadPropertyUpgrade(root,manifestPath,target),db=new DatabaseSync(resolve(filename),{readOnly:true});
 // Connection settings only. Never use immutable mode: committed WAL schema must be visible.
 // One read transaction prevents schema/journal/count observations from spanning different commits.
 try{
  db.exec('PRAGMA foreign_keys=ON; PRAGMA query_only=ON; BEGIN');
  return evaluatePropertyUpgrade(await capturePropertyUpgradeMetadata({all:sql=>db.prepare(sql).all(),get:sql=>db.prepare(sql).get()},root),packageData);
 }finally{db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [filename,root,manifestPath,target]=process.argv.slice(2);if(!target)throw Error('Usage: node scripts/property-upgrade-preflight.mjs LOCAL_SQLITE_FILE CANDIDATE_ROOT REVIEW_MANIFEST live|doomsday|staging');
 const report=await inspectPropertyUpgradeFile(filename,root,manifestPath,target);console.log(JSON.stringify(report,null,2));process.exitCode=report.eligibleForSeparatelyApprovedUpgrade||report.candidatePropertySchemaReady?0:1;
}
