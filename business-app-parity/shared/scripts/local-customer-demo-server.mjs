// Localhost-only development server: no application routes, database API or deployment.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url),ts=require('typescript');
export async function startCustomerDemo(port=0,{testRevision=''}={}){
 // Local test harness only: vary worker bytes without changing business/vault source.
 if (!/^[a-z0-9-]{0,64}$/.test(testRevision)) throw new Error('Invalid synthetic test revision');
 const modules=new Map();
 for(const [url,path] of [['/store.js','../lib/local-customer-store.ts'],['/backup.js','../lib/local-customer-backup.ts'],['/vault.js','../lib/local-customer-vault.ts'],['/demo.js','./local-customer-demo.ts']]){
  const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  modules.set(url,code.replaceAll(/(['"])(?:\.\.\/lib\/|\.\/)(local-customer-store|local-customer-backup|local-customer-vault)\1/g,(_,q,name)=>q+({'local-customer-store':'/store.js','local-customer-backup':'/backup.js','local-customer-vault':'/vault.js'}[name])+q));
 }
 const scope='/synthetic-customer-demo/';
 for(const [url,code] of [...modules]){modules.delete(url);modules.set(scope+url.slice(1),code.replaceAll("'/store.js'","'"+scope+"store.js'").replaceAll("'/backup.js'","'"+scope+"backup.js'").replaceAll("'/vault.js'","'"+scope+"vault.js'"));}
 const html=readFileSync(new URL('./local-customer-demo.html',import.meta.url),'utf8').replace('src="/demo.js"','src="'+scope+'demo.js"');
 const template=readFileSync(new URL('./local-customer-demo-worker.js',import.meta.url),'utf8');
 const version=createHash('sha256').update(html+JSON.stringify([...modules])+template+testRevision).digest('hex').slice(0,24);
 const worker=template.replace('__CACHE_NAME__','fire-synthetic-customer-shell:'+version).replace('__ASSET_LIST__',JSON.stringify([scope,...modules.keys()]));
 const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');if(req.url==='/'){res.writeHead(302,{Location:scope});res.end();}else if(req.url===scope){res.setHeader('X-Fire-Synthetic-Asset','1');res.setHeader('Content-Type','text/html');res.end(html);}else if(req.url===scope+'worker.js'){res.setHeader('Content-Type','text/javascript');res.end(worker);}else if(modules.has(req.url)){res.setHeader('X-Fire-Synthetic-Asset','1');res.setHeader('Content-Type','text/javascript');res.end(modules.get(req.url));}else{res.statusCode=404;res.end();}});
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 return {server,origin:`http://127.0.0.1:${server.address().port}`,scope,version};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {origin}=await startCustomerDemo(Number(process.argv[2]||0));console.log(`Synthetic customer demo: ${origin}; local only, real records disabled.`);}
