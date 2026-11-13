/** FIRE offline schema identity: prove export and isolated restore use the
 * same exact table/column/index/trigger/foreign-key contract.
 * No cloud/provider calls. Never infer schema from a table name alone.
 */
import {createHash} from 'node:crypto';
const stop=why=>{throw Error('FIRE isolated schema identity BLOCKED: '+why);};
const ident=x=>typeof x==='string'&&/^[a-z][a-z0-9_]*$/.test(x);
const q=x=>'"'+x+'"';
export function fingerprintIsolatedSqliteSchema(db){
 const objects=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
 if(!objects.length)stop('empty SQLite schema');
 const tables=objects.filter(x=>x.type==='table').map(x=>x.name);
 if(tables.some(x=>!ident(x)))stop('unsupported table names');
 const columns={};
 for(const table of tables){
  const rows=db.prepare('PRAGMA table_xinfo('+q(table)+')').all();
  if(!rows.length||rows.some(x=>!ident(x.name)))stop('unsupported columns in '+table);
  columns[table]=rows.map(x=>({name:x.name,type:x.type,notnull:x.notnull,pk:x.pk,hidden:x.hidden,dflt_value:x.dflt_value}));
 }
 const payload=JSON.stringify({objects,columns});
 return Object.freeze({format:'fire-isolated-sqlite-schema',version:1,
  sha256:createHash('sha256').update(payload).digest('hex'),
  tables:tables.length,objects:objects.length});
}
export function requireSameIsolatedSchema(expected,actual){
 if(!expected||expected.format!=='fire-isolated-sqlite-schema'||
    expected.version!==1||!/^[a-f0-9]{64}$/.test(expected.sha256||'')||
    expected.sha256!==actual.sha256||expected.tables!==actual.tables||
    expected.objects!==actual.objects)
  stop('source and isolated destination schema differ; migration/reconciliation required');
}
