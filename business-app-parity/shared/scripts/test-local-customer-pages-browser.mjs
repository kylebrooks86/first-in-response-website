// HTTPS lab only: local-only CONNECT proxy + temporary certificate. Never contacts Pages.
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {createServer as createProxy} from 'node:http';
import {connect} from 'node:net';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {prepareSyntheticPages} from './prepare-local-customer-pages.mjs';
import {buildCustomerDemoAssets,SYNTHETIC_PAGES_ORIGIN} from './local-customer-demo-assets.mjs';
const root=mkdtempSync(join(tmpdir(),'fire-pages-lab-')),packageRoot=join(root,'review'),profile=join(root,'browser');
const require=createRequire(import.meta.url),{chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const review=prepareSyntheticPages(packageRoot),upload=join(packageRoot,'upload');let context,server,proxy,labPort,proxyPort,passed=0;const requests=[];
async function check(name,fn){await fn();passed++;console.log('PASS: '+name);}
async function launch(offline){context=await chromium.launchPersistentContext(profile,{executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,headless:true,args:['--no-sandbox','--disable-gpu','--ignore-certificate-errors','--proxy-server=http://127.0.0.1:'+proxyPort,'--proxy-bypass-list=<-loopback>'],viewport:{width:390,height:844}});await context.setOffline(offline);context.on('request',r=>requests.push(r.url()));}
async function close(){const b=context.browser();await context.close();context=null;assert.equal(b.isConnected(),false);}
try{
 await check('only the exact proposed origin can be packaged',()=>{assert.throws(()=>buildCustomerDemoAssets({deploymentOrigin:'https://fire-app.kylebrooks8605.chatgpt.site'}),/Unreviewed/);assert.equal(review.publicationAuthorized,false);assert.deepEqual(review.bindings,[]);assert.equal(review.files.length,13);assert.ok(!review.files.some(r=>/functions|_worker|auth|receipt|serve-demo/.test(r.file)));});
 await check('existing review destinations are preserved',()=>assert.throws(()=>prepareSyntheticPages(packageRoot),/existing/));
 const rules=new Map();let current;for(const line of readFileSync(join(upload,'_headers'),'utf8').split('\n')){if(!line)continue;if(!line.startsWith(' ')){current=line;rules.set(current,{});}else{const at=line.indexOf(':');rules.get(current)[line.slice(0,at).trim()]=line.slice(at+1).trim();}}
 const routes=new Map(review.files.filter(r=>r.file.startsWith('synthetic-customer-demo/')).map(r=>['/'+r.file.replace('index.html',''),r.file]));
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(root,'key.pem'),'-out',join(root,'cert.pem'),'-days','1','-subj','/CN=fire-synthetic-offline-test-bfc00939.pages.dev'],{stdio:'ignore'});
 server=createServer({key:readFileSync(join(root,'key.pem')),cert:readFileSync(join(root,'cert.pem'))},(req,res)=>{const file=routes.get(req.url);res.writeHead(file?200:404,{...rules.get('/*'),...(rules.get(req.url)||{})});res.end(readFileSync(join(upload,file||'404.html')));});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});labPort=server.address().port;
 proxy=createProxy();proxy.on('connect',(req,socket,head)=>{if(req.url!=='fire-synthetic-offline-test-bfc00939.pages.dev:443'&&req.url!=='rejected-synthetic.invalid:443'){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}const upstream=connect(labPort,'127.0.0.1',()=>{socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);});upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());socket.on('close',()=>upstream.destroy());});await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));proxyPort=proxy.address().port;
 await launch(false);let page=await context.newPage();await page.goto(SYNTHETIC_PAGES_ORIGIN+review.scope);await page.waitForFunction(()=>document.getElementById('offline-shell').textContent.includes('ready'));
 await check('exact-origin HTTPS lab installs under scoped headers and strict CSP',async()=>{await page.waitForFunction(()=>navigator.serviceWorker.controller);assert.deepEqual(await page.evaluate(async()=> (await navigator.serviceWorker.getRegistrations()).map(r=>r.scope)),[SYNTHETIC_PAGES_ORIGIN+review.scope]);assert.equal(await page.evaluate(()=>isSecureContext),true);assert.equal(await page.evaluate(()=>document.getElementById('unlock-controls').disabled),false);});
 await check('declared MIME types and narrow maximum worker scope match assets',async()=>{for(const [file,type] of [['demo.js','text/javascript'],['manifest.webmanifest','application/manifest+json'],['icon-180.png','image/png']])assert.equal(await page.evaluate(async file=>(await fetch('./'+file)).headers.get('Content-Type'),file),type);assert.equal(rules.get(review.scope+'worker.js')['Service-Worker-Allowed'],review.scope);});
 await check('unlisted API routes do not become the app shell',async()=>{assert.equal(await page.evaluate(async()=>(await fetch('./api/customers')).status),404);assert.equal(await page.evaluate(async()=>{const cache=await caches.open((await caches.keys()).find(n=>n.startsWith('fire-synthetic-customer-shell:')));return (await cache.keys()).length;}),8);});
 await check('same-origin pages outside the directory have no worker controller',async()=>{const outside=await context.newPage();await outside.goto(SYNTHETIC_PAGES_ORIGIN+'/outside');assert.equal(await outside.evaluate(()=>navigator.serviceWorker.controller),null);await outside.close();});
 await check('copied shell refuses registration on an unapproved HTTPS origin',async()=>{const denied=await context.newPage();await denied.goto('https://rejected-synthetic.invalid'+review.scope);await denied.waitForFunction(()=>document.getElementById('offline-shell').textContent.includes('unavailable'));assert.equal(await denied.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).length),0);await denied.close();});
 const phrase='synthetic pages lab phrase';await page.fill('#phrase',phrase);await page.click('#unlock');await page.waitForFunction(()=>!document.getElementById('records').hidden);await page.selectOption('#name','Synthetic Updated');await page.fill('#save-phrase',phrase);await page.click('#save');await page.waitForFunction(()=>document.getElementById('customer').textContent.includes('Revision 2'));
 await close();await new Promise(resolve=>server.close(resolve));server=null;await launch(true);page=await context.newPage();await page.goto(SYNTHETIC_PAGES_ORIGIN+review.scope);await page.waitForFunction(()=>document.getElementById('offline-shell').textContent.includes('ready'));await page.fill('#phrase',phrase);await page.click('#unlock');await page.waitForFunction(()=>!document.getElementById('records').hidden);
 await check('prepared HTTPS shell cold launches offline and retains encrypted revision',async()=>assert.match(await page.locator('#customer').textContent(),/Synthetic Updated.*Revision 2/));
 await check('requests remain isolated from production services',()=>{assert.ok(requests.every(url=>[SYNTHETIC_PAGES_ORIGIN,'https://rejected-synthetic.invalid'].includes(new URL(url).origin)));});
 console.log(JSON.stringify({passed,total:9,httpsLab:true,localOnlyProxy:true,temporaryCertificateBypass:true,cloudflarePublished:false,realTlsVerified:false,iPhoneTested:false,nativeIndexedDB:true,nativeWebCrypto:true}));
}finally{await context?.close();if(server)await new Promise(resolve=>server.close(resolve));if(proxy)await new Promise(resolve=>proxy.close(resolve));rmSync(root,{recursive:true,force:true});}
