import {propertyBackupError,propertyBackupManifest} from './property-backup.mjs';
import {serviceLocationManifest} from './service-location-backup.mjs';
import {validateRecordIdentities,validateBackupRelationships,validateRefundIntegrity} from '../scripts/records-backup-integrity.mjs';
import {customerPropertiesEnabled} from './customer-properties';
export const PROPERTY_RECOVERY_TABLES=['customers','estimates','customer_notes','invoices','invoice_items','invoice_revisions','payment_checkout_sessions','estimate_items','payments','payment_refunds','customer_messages','notifications','message_templates','estimate_change_requests','tasks','expenses','job_reports','customer_photos','estimate_service_locations','customer_properties','estimate_property_links'] as const;
export function propertyRecoveryTestEnabled(env:{FIRE_CUSTOMER_PROPERTIES_CANDIDATE?:string;FIRE_SERVICE_LOCATIONS_CANDIDATE?:string;FIRE_PROPERTY_RECOVERY_CANDIDATE?:string}){
 return customerPropertiesEnabled(env)&&env.FIRE_PROPERTY_RECOVERY_CANDIDATE==='synthetic-tests-only';
}

function photoMetadataError(tables:Record<string,unknown>){
 const photos=tables.customer_photos;if(!Array.isArray(photos))return 'Photo metadata coverage is missing.';
 const seen=new Set<string>();
 for(const row of photos as Record<string,unknown>[]){
  const key=row.object_key;
  if(typeof key!=='string'||!key.startsWith(`customers/${row.customer_id}/${row.id}.`)||key.includes('..')||seen.has(key))return 'Unsafe or duplicate photo object identity.';
  seen.add(key);
  if(typeof row.content_type!=='string'||!row.content_type.startsWith('image/')||!['before','after','property'].includes(String(row.category))||typeof row.size_bytes!=='number'||!Number.isSafeInteger(row.size_bytes)||row.size_bytes<0||row.size_bytes>20*1024*1024)return 'Invalid photo metadata.';
 }
 return null;
}

export async function exportPropertyRecords(db:D1Database){
 const results=await db.batch<Record<string,unknown>>(PROPERTY_RECOVERY_TABLES.map(table=>db.prepare(`SELECT * FROM ${table}`)));
 if(results.some(result=>!Array.isArray(result.results)))throw Error('Incomplete property backup read');
 const tables=Object.fromEntries(PROPERTY_RECOVERY_TABLES.map((table,i)=>[table,results[i].results]));
 const payload={format:'fire-app-records-backup',version:1,exportedAt:new Date().toISOString(),includes:{databaseRecords:true,photoMetadata:true,photoFiles:false,invoiceRevisionHistory:true,paymentCheckoutSessionSafety:true,paymentRefundHistory:true,serviceAddressSnapshots:true,customerProperties:true},warning:'Photo bytes are stored separately. Restore metadata only with its matching photo archive.',tables,serviceLocationSnapshots:serviceLocationManifest(tables.estimate_service_locations),customerProperties:propertyBackupManifest(tables.customer_properties,tables.estimate_property_links)};
 const error=validateRecordIdentities(tables)||validateBackupRelationships(tables)||validateRefundIntegrity(tables)||propertyBackupError(payload,tables)||photoMetadataError(tables);
 if(error)throw Error(error);
 return payload;
}
export async function restorePropertyRecords(db:D1Database,payload:Record<string,unknown>,tables:Record<string,unknown>){
 const audit={attemptId:crypto.randomUUID(),atomic:true,writesCommitted:null as boolean|null,phase:'validation',restored:0,photoFilesRestored:false};
 const reject=(error:string,status=400)=>Response.json({error,restoreAudit:audit},{status});
 const error=validateRecordIdentities(tables)||validateBackupRelationships(tables)||validateRefundIntegrity(tables)||propertyBackupError(payload,tables)||photoMetadataError(tables);
 if(error)return reject(error);
 if(Object.keys(tables).some(table=>!PROPERTY_RECOVERY_TABLES.includes(table as typeof PROPERTY_RECOVERY_TABLES[number])))return reject('Unknown backup table; complete recovery cannot be verified.');
 if(PROPERTY_RECOVERY_TABLES.some(table=>!Array.isArray(tables[table])))return reject('Property recovery requires every records table, including photo metadata.');
 const count=PROPERTY_RECOVERY_TABLES.reduce((sum,table)=>sum+(tables[table] as unknown[]).length,0);
 if(count>4900)return reject('Property backup exceeds the native atomic restore limit.',413);
 const exists=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='property_recovery_guard'").first();
 if(!exists)return reject('Native atomic property recovery schema is unavailable.',409);
 const foreignKeys=(await db.prepare('PRAGMA foreign_keys').first<{foreign_keys:number}>())?.foreign_keys;
 if(foreignKeys!==1)return reject('Native foreign-key enforcement is unavailable.',409);
 const guardTrigger=await db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='property_recovery_empty_destination'").first<{sql:string}>();
 const canonical=(sql:string)=>sql.replace(/\s+/g,' ').trim().replace(/;$/,'');
 const expectedGuard="CREATE TRIGGER property_recovery_empty_destination BEFORE INSERT ON property_recovery_guard WHEN "+PROPERTY_RECOVERY_TABLES.map(table=>`EXISTS(SELECT 1 FROM ${table})`).join(' OR ')+" BEGIN SELECT RAISE(ABORT,'Recovery destination is occupied'); END";
 if(!guardTrigger||canonical(guardTrigger.sql)!==canonical(expectedGuard))return reject('Native atomic destination guard is missing or incompatible.',409);
 const occupiedSql=PROPERTY_RECOVERY_TABLES.map(table=>`EXISTS(SELECT 1 FROM ${table})`).join(' OR ');
 if((await db.prepare(`SELECT CASE WHEN ${occupiedSql} THEN 1 ELSE 0 END AS occupied`).first<{occupied:number}>())?.occupied)return reject('Property recovery requires an empty destination. Existing records were preserved.',409);
 const plans:{table:string;columns:string[];values:(string|number|null)[]}[]=[];
 const now=new Date().toISOString();
 for(const table of PROPERTY_RECOVERY_TABLES){
  const schema=(await db.prepare(`PRAGMA table_info(${table})`).all<{name:string;notnull:number;dflt_value:unknown}>()).results;
  if(!schema.length)return reject('Required recovery table is unavailable: '+table,409);
  const columns=schema.map(column=>column.name);
  for(const raw of tables[table] as Record<string,unknown>[]){
   if(Object.keys(raw).sort().join(',')!==[...columns].sort().join(','))return reject('Incomplete or incompatible record columns: '+table);
   const row={...raw};
   // Never reactivate a provider checkout or an unresolved refund on recovery.
   if(table==='payment_checkout_sessions'&&row.status==='open'){row.status='expired';row.expired_at=now;}
   if(table==='payment_refunds'&&row.status==='pending'){row.status='failed';row.completed_at=now;}
   const values=columns.map(column=>row[column]);
   if(values.some(value=>value!==null&&typeof value!=='string'&&(typeof value!=='number'||!Number.isFinite(value))))return reject('Invalid record value: '+table);
   plans.push({table,columns,values:values as (string|number|null)[]});
  }
 }
 const statements=[db.prepare('INSERT INTO property_recovery_guard(id) VALUES(1)'),...plans.map(plan=>db.prepare(`INSERT INTO ${plan.table} (${plan.columns.map(column=>'"'+column+'"').join(',')}) VALUES (${plan.columns.map(()=>'?').join(',')})`).bind(...plan.values)),db.prepare('DELETE FROM property_recovery_guard WHERE id=1')];
 audit.phase='atomic_apply';
 try{
  const results=await db.batch(statements);
  audit.writesCommitted=true;audit.restored=results.slice(1,-1).reduce((sum,result)=>sum+Number(result.meta.changes??0),0);
  audit.phase='complete';
  return Response.json({restored:audit.restored,restoreAudit:audit,message:'Property records and immutable history restored atomically. Photo files require their separate archive.'});
 }catch{
  audit.phase='outcome_unconfirmed';
  return reject('Recovery did not return a confirmed result. Review the destination before retrying; no automatic retry is safe.',503);
 }
}
