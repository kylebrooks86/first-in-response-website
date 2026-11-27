// Local preparation only. No network, CLI deployment, bindings or authentication.
import {buildCustomerDemoAssets,SYNTHETIC_PAGES_ORIGIN} from './local-customer-demo-assets.mjs';
import {existsSync,mkdirSync,mkdtempSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function prepareSyntheticPages(destination){
 const target=resolve(destination);if(existsSync(target))throw Error('Refusing existing destination');
 const {scope,version,assets,worker}=buildCustomerDemoAssets({deploymentOrigin:SYNTHETIC_PAGES_ORIGIN});
 mkdirSync(dirname(target),{recursive:true});const staging=mkdtempSync(join(dirname(target),'.fire-pages-review-'));
 try{
  const upload=join(staging,'upload');mkdirSync(join(upload,'synthetic-customer-demo'),{recursive:true});
  const files=[],hash=body=>createHash('sha256').update(body).digest('hex');
  function write(file,body){writeFileSync(join(upload,file),body);files.push({file,sha256:hash(body),bytes:Buffer.byteLength(body)});}
  for(const [path,{body}] of [...assets,[scope+'worker.js',{body:Buffer.from(worker)}]])write('synthetic-customer-demo/'+(path.slice(scope.length)||'index.html'),body);
  const html=assets.get(scope).body.toString();
  const hashes=[...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(m=>"'sha256-"+createHash('sha256').update(m[1]).digest('base64')+"'");
  if(hashes.length!==1)throw Error('Review inline bootstrap before publication');
  const csp="default-src 'none'; script-src 'self' "+hashes.join(' ')+"; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";
  let headers="/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex, nofollow\n  Content-Security-Policy: "+csp+"\n";
  for(const [path,{type}] of assets)headers+=path+'\n  Content-Type: '+type+'\n  X-Fire-Synthetic-Asset: 1\n';
  headers+=scope+"worker.js\n  Content-Type: text/javascript\n  Service-Worker-Allowed: "+scope+'\n';
  write('_headers',headers);write('_redirects','/ '+scope+' 302\n');write('404.html','<!doctype html><title>Not found</title><p>Isolated synthetic demonstration only.</p>');write('robots.txt','User-agent: *\nDisallow: /\n');
  const review={schemaVersion:1,publicationAuthorized:false,origin:SYNTHETIC_PAGES_ORIGIN,project:'fire-synthetic-offline-test-bfc00939',scope,version,uploadDirectory:'upload',staticOnly:true,bindings:[],functions:[],realRecordsIncluded:false,files};
  writeFileSync(join(staging,'publication-review.json'),JSON.stringify(review,null,2)+'\n');
  if(existsSync(target))throw Error('Destination appeared; preserved');renameSync(staging,target);return {...review,destination:target};
 }catch(error){rmSync(staging,{recursive:true,force:true});throw error;}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw Error('Provide a fresh local review directory');const r=prepareSyntheticPages(process.argv[2]);console.log(JSON.stringify({origin:r.origin,scope:r.scope,version:r.version,files:r.files.length,publicationAuthorized:false,destination:r.destination}));
}
