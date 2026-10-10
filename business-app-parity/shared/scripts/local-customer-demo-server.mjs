// Localhost-only development server: no application routes, database API or deployment.
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {buildCustomerDemoAssets} from './local-customer-demo-assets.mjs';
export async function startCustomerDemo(port=0,options={}){
 const {scope,version,assets,worker}=buildCustomerDemoAssets(options);
 const server=createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.url==='/'){res.writeHead(302,{Location:scope});res.end();}
  else if(req.url===scope+'worker.js'){res.setHeader('Content-Type','text/javascript');res.end(worker);}
  else if(assets.has(req.url)){const asset=assets.get(req.url);res.setHeader('X-Fire-Synthetic-Asset','1');res.setHeader('Content-Type',asset.type);res.end(asset.body);}
  else{res.statusCode=404;res.end();}
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 return {server,origin:`http://127.0.0.1:${server.address().port}`,scope,version};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {origin}=await startCustomerDemo(Number(process.argv[2]||0));console.log(`Synthetic customer demo: ${origin}; local only, real records disabled.`);}
