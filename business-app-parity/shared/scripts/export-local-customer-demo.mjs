// Build-time only. Exports static code/artwork; never exports IndexedDB or business records.
import {buildCustomerDemoAssets} from './local-customer-demo-assets.mjs';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function exportCustomerDemo(destination){
 const target=resolve(destination);
 if(existsSync(target))throw Error('Refusing to overwrite an existing destination');
 const {scope,version,assets,worker}=buildCustomerDemoAssets();
 mkdirSync(dirname(target),{recursive:true});const staging=mkdtempSync(join(dirname(target),'.fire-synthetic-package-'));
 try{
  mkdirSync(join(staging,'synthetic-customer-demo'));
  const files=[];
  for(const [path,{body,type}] of [...assets,[scope+'worker.js',{body:Buffer.from(worker),type:'text/javascript'}]]){
   const file='synthetic-customer-demo/'+(path.slice(scope.length)||'index.html');writeFileSync(join(staging,file),body);
   files.push({path,file,type,sha256:createHash('sha256').update(body).digest('hex')});
  }
  writeFileSync(join(staging,'package-receipt.json'),JSON.stringify({schemaVersion:1,scope,version,syntheticOnly:true,realRecordsIncluded:false,files},null,2)+'\n');
  writeFileSync(join(staging,'serve-demo.mjs'),readFileSync(new URL('./local-customer-demo-package-server.mjs',import.meta.url)));
  writeFileSync(join(staging,'README.txt'),'FIRE Demo: synthetic records only. No real customer records included.\nRun: node serve-demo.mjs 4178\nOpen: http://127.0.0.1:4178/synthetic-customer-demo/\nKeep the same port to return to the same storage origin.\nNo node_modules, ChatGPT, framework or database server is required to serve this built package.\nAn initial online load is required before offline browser launch. Browser storage can be cleared or evicted.\nThis localhost-only package is NOT an iPhone test URL. HTTPS test publication, allowed-origin review and actual iPhone verification are still pending; no deployment is authorized.\n');
  if(existsSync(target))throw Error('Destination appeared during export; preserved');
  renameSync(staging,target);return {destination:target,version,staticFiles:files.length,packageName:basename(target)};
 }catch(error){rmSync(staging,{recursive:true,force:true});throw error;}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw Error('Provide a fresh local export directory');
 console.log(JSON.stringify(exportCustomerDemo(process.argv[2])));
}
