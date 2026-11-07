import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const valueAfter = (name) => { const i=args.indexOf(name); return i>=0?args[i+1]:undefined; };
const has=(name)=>args.includes(name);
const configPath=valueAfter('--config')||'dist/server/wrangler.independent.json';
const apply=has('--apply');
const local=has('--local');
const remote=has('--remote');
const persistTo=valueAfter('--persist-to')||'.wrangler/state';
if(local===remote){console.error('Usage: npm run parity:fixture:remove -- (--local | --remote) [--config <path>] [--persist-to <path>] [--apply] [--confirm-database <name>] [--confirm-bucket <name>]');process.exit(1);}
const root=resolve(new URL('..',import.meta.url).pathname);
const config=JSON.parse(await readFile(resolve(configPath),'utf8'));
const db=config.d1_databases?.find((item)=>item.binding==='DB');
const bucket=config.r2_buckets?.find((item)=>item.binding==='BUCKET')?.bucket_name;
if(!db?.database_name||!db.database_id||!bucket) throw new Error('DB and BUCKET must be configured.');
if(remote&&apply&&(valueAfter('--confirm-database')!==db.database_name||valueAfter('--confirm-bucket')!==bucket)) throw new Error(`Remote apply requires --confirm-database ${db.database_name} --confirm-bucket ${bucket}`);
const wrangler=resolve(root,'node_modules/wrangler/bin/wrangler.js');
const mode=local?['--local','--persist-to',persistTo]:['--remote'];
const run=(parts)=>spawnSync(process.execPath,[wrangler,...parts],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
const photoKeys=['customers/parity-customer-001/parity-photo-001.png','customers/parity-customer-001/parity-photo-002.png'];
const tables=['customer_photos','job_reports','expenses','tasks','estimate_change_requests','notifications','customer_messages','payment_refunds','payment_checkout_sessions','payments','invoice_revisions','invoice_items','estimate_items','invoices','customer_notes','estimates','customers','message_templates'];
console.log(JSON.stringify({targetDatabase:db.database_name,targetBucket:bucket,mode:local?'local':'remote',apply,deletePrefix:'parity-'},null,2));
if(!apply){console.log('Dry run complete. No records or objects were changed.');process.exit(0);}
for(const key of photoKeys){const result=run(['r2','object','delete',`${bucket}/${key}`,'--config',resolve(configPath),...mode]);if(result.status!==0){const detail=`${result.stdout||''}\n${result.stderr||''}`;if(!/does not exist|not found/i.test(detail))throw new Error(`Could not remove parity photo ${key}: ${detail}`);}}
for(const table of tables){const identity=table==='message_templates'?'key':'id';const result=run(['d1','execute','DB','--config',resolve(configPath),...mode,'--yes','--command',`DELETE FROM ${table} WHERE ${identity} LIKE 'parity-%'`]);if(result.status!==0)throw new Error(`Could not clean ${table}: ${result.stderr||result.stdout}`);}
console.log('Parity fixture removed. Only parity-* records and known parity photo objects were targeted.');
