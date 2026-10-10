// Portable, dependency-free localhost server for an exported synthetic package.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function startPackagedCustomerDemo(root,port=0){
 const scope='/synthetic-customer-demo/';
 const required=[['', 'text/html'],['store.js','text/javascript'],['backup.js','text/javascript'],['vault.js','text/javascript'],['demo.js','text/javascript'],['manifest.webmanifest','application/manifest+json'],['icon-180.png','image/png'],['icon-512.png','image/png'],['worker.js','text/javascript']];
 const receipt=JSON.parse(readFileSync(join(root,'package-receipt.json'),'utf8'));
 if(receipt.schemaVersion!==1||receipt.scope!==scope||!Array.isArray(receipt.files)||receipt.files.length!==required.length)throw Error('Invalid synthetic package receipt');
 const routes=new Map();
 for(const [name,type] of required){
  const path=scope+name,file='synthetic-customer-demo/'+(name||'index.html');
  const entries=receipt.files.filter(row=>row.path===path&&row.file===file&&row.type===type);
  if(entries.length!==1)throw Error('Synthetic package inventory mismatch');
  const body=readFileSync(join(root,file));
  if(createHash('sha256').update(body).digest('hex')!==entries[0].sha256)throw Error('Synthetic package file changed');
  routes.set(path,{body,type});
 }
 const server=createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;res.end();return;}
  if(req.url==='/'){res.writeHead(302,{Location:scope});res.end();return;}
  const route=routes.get(req.url);
  if(!route){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type',route.type);
  if(req.url!==scope+'worker.js')res.setHeader('X-Fire-Synthetic-Asset','1');
  res.end(req.method==='HEAD'?undefined:route.body);
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 return {server,scope,origin:`http://127.0.0.1:${server.address().port}`,version:receipt.version};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const app=await startPackagedCustomerDemo(fileURLToPath(new URL('.',import.meta.url)),Number(process.argv[2]||0));
 console.log(`FIRE Demo (synthetic only): ${app.origin}${app.scope}; localhost only, no deployment.`);
}
