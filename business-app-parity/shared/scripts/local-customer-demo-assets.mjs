// Deterministic static demo builder. No customer/database data is read or included.
// Localhost-only development server: no application routes, database API or deployment.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
export const SYNTHETIC_PAGES_ORIGIN='https://fire-synthetic-offline-test-bfc00939.pages.dev';
export function buildCustomerDemoAssets({testRevision='',deploymentOrigin=null}={}){
 if(deploymentOrigin!==null&&deploymentOrigin!==SYNTHETIC_PAGES_ORIGIN)throw new Error('Unreviewed synthetic deployment origin');
 // Local test harness only: vary worker bytes without changing business/vault source.
 if (!/^[a-z0-9-]{0,64}$/.test(testRevision)) throw new Error('Invalid synthetic test revision');
 const modules=new Map();
 for(const [url,path] of [['/store.js','../lib/local-customer-store.ts'],['/backup.js','../lib/local-customer-backup.ts'],['/vault.js','../lib/local-customer-vault.ts'],['/demo.js','./local-customer-demo.ts']]){
  const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  modules.set(url,code.replaceAll(/(['"])(?:\.\.\/lib\/|\.\/)(local-customer-store|local-customer-backup|local-customer-vault)\1/g,(_,q,name)=>q+({'local-customer-store':'/store.js','local-customer-backup':'/backup.js','local-customer-vault':'/vault.js'}[name])+q));
 }
 const scope='/synthetic-customer-demo/';
 for(const [url,code] of [...modules]){modules.delete(url);modules.set(scope+url.slice(1),code.replaceAll("'/store.js'","'"+scope+"store.js'").replaceAll("'/backup.js'","'"+scope+"backup.js'").replaceAll("'/vault.js'","'"+scope+"vault.js'"));}
 if(deploymentOrigin){
  const path=scope+'demo.js',guard="!['127.0.0.1', 'localhost'].includes(location.hostname)",code=modules.get(path);
  if(code.split(guard).length!==2)throw new Error('Synthetic origin guard changed; review before packaging');
  modules.set(path,code.replace(guard,'location.origin !== '+JSON.stringify(deploymentOrigin)));
 }
 const html=readFileSync(new URL('./local-customer-demo.html',import.meta.url),'utf8');
 const template=readFileSync(new URL('./local-customer-demo-worker.js',import.meta.url),'utf8');
 const assets=new Map([[scope,{body:Buffer.from(html),type:'text/html'}],...Array.from(modules,([path,body])=>[path,{body:Buffer.from(body),type:'text/javascript'}])]);
 const manifest={name:'FIRE Synthetic Customer Demo',short_name:'FIRE Demo',description:'Synthetic encrypted customer test only. Real business records are inactive.',id:scope,start_url:scope,scope,display:'standalone',background_color:'#111827',theme_color:'#111827',icons:[{src:'icon-180.png',sizes:'180x180',type:'image/png',purpose:'any'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'}]};
 assets.set(scope+'manifest.webmanifest',{body:Buffer.from(JSON.stringify(manifest)),type:'application/manifest+json'});
 for(const [size,file] of [[180,'fire-app-home-v2.png'],[512,'fire-app-home-512-v2.png']])assets.set(scope+`icon-${size}.png`,{body:readFileSync(new URL('../public/'+file,import.meta.url)),type:'image/png'});
 const digest=createHash('sha256').update(template+testRevision);
 for(const [path,{body}] of assets)digest.update(path).update(body);
 const version=digest.digest('hex').slice(0,24);
 const worker=template.replace('__CACHE_NAME__','fire-synthetic-customer-shell:'+version).replace('__ASSET_LIST__',JSON.stringify([...assets.keys()]));
 return {scope,version,assets,worker};
}
