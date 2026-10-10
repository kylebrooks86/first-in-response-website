// Localhost-only development server: no application routes, database API or deployment.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url),ts=require('typescript');
export async function startCustomerDemo(port=0){
 const modules=new Map();
 for(const [url,path] of [['/store.js','../lib/local-customer-store.ts'],['/backup.js','../lib/local-customer-backup.ts'],['/vault.js','../lib/local-customer-vault.ts'],['/demo.js','./local-customer-demo.ts']]){
  const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  modules.set(url,code.replaceAll(/(['"])(?:\.\.\/lib\/|\.\/)(local-customer-store|local-customer-backup|local-customer-vault)\1/g,(_,q,name)=>q+({'local-customer-store':'/store.js','local-customer-backup':'/backup.js','local-customer-vault':'/vault.js'}[name])+q));
 }
 const html=readFileSync(new URL('./local-customer-demo.html',import.meta.url),'utf8');
 const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);}else if(modules.has(req.url)){res.setHeader('Content-Type','text/javascript');res.end(modules.get(req.url));}else{res.statusCode=404;res.end();}});
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 return {server,origin:`http://127.0.0.1:${server.address().port}`};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {origin}=await startCustomerDemo(Number(process.argv[2]||0));console.log(`Synthetic customer demo: ${origin}; local only, real records disabled.`);}
