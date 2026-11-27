import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

// Verify the real strict three-target contract on disposable, synthetic files.
// No customer data, deployments, accounts, secrets or hosted services.
const root=mkdtempSync(join(tmpdir(),'fire-three-version-parity-'));
const names=['live','doomsday','staging'],dirs=names.map(name=>join(root,name));
const script=resolve('scripts/check-app-parity.mjs');
const bridge='// Independent deployment adapter; never trusts Sites authentication headers.\nexport { getOwnerUser as getChatGPTUser, requireOwnerUser as requireChatGPTUser, ownerSignInPath as chatGPTSignInPath, ownerSignOutPath as chatGPTSignOutPath } from "./owner-auth";\n';
const livePage='export default function Home(){return <Dashboard userName="Synthetic FIRE" />;}\n';
const page=(name)=>name==='live'?livePage:livePage.replace(' userName=', ' environment="'+name.toUpperCase()+'" userName=');
function put(index,path,text){
 const full=join(dirs[index],path);
 mkdirSync(full.slice(0,full.lastIndexOf('/')),{recursive:true});
 writeFileSync(full,text);
}
const check=()=>spawnSync(process.execPath,[script,...dirs],{encoding:'utf8'});
function passes(label){const run=check();assert.equal(run.status,0,label+': '+run.stdout+' '+run.stderr);let result=JSON.parse(run.stdout);assert.equal(result.sharedSourceParity,true);assert.equal(result.hostedVersionsCompared,false);}
function refuses(label,path){
 const run=check();assert.equal(run.status,1,label+': '+run.stdout+' '+run.stderr);
 assert.ok(JSON.parse(run.stdout).differences.some(item=>item.path===path),label+' did not identify '+path);
}
try{
 for(const [i,name] of names.entries()){
  put(i,'hooks/mobile.ts','shared offline mobile hook');
  put(i,'vendor/style.css','shared bundled UI CSS');
  put(i,'app/layout.tsx','Shared iPhone viewport, top-level DOM and PWA metadata');
  put(i,'app/dashboard.tsx','Full synthetic React dashboard');
  put(i,'app/manifest.ts','Identical installed-app PWA metadata');
  put(i,'app/globals.css','Identical FIRE light/dark, mobile and desktop styles');
  put(i,'app/page.tsx',page(name));
  put(i,'app/local-customer-deployment.ts',"/** Fixed server deployment adapter. */\nexport const LOCAL_CUSTOMER_DEPLOYMENT = '"+name+"' as const;\n");
  put(i,'app/chatgpt-auth.ts',name==='doomsday'?bridge:'Identical protected Sites authentication');
  if(name==='doomsday')put(i,'app/owner-auth.ts','Independent signed owner session adapter');
 }
 passes('Valid three-target app and intended Doomsday env/auth difference');
 put(1,'hooks/mobile.ts','broken offline mobile hook');refuses('Shared mobile hook drift','hooks/mobile.ts');put(1,'hooks/mobile.ts','shared offline mobile hook');
 unlinkSync(join(dirs[2],'vendor/style.css'));refuses('Missing bundled stylesheet','vendor/style.css');put(2,'vendor/style.css','shared bundled UI CSS');
 put(1,'app/layout.tsx','Altered Doomsday iPhone viewport');refuses('Root layout/viewport drift','app/layout.tsx');put(1,'app/layout.tsx','Shared iPhone viewport, top-level DOM and PWA metadata');
 put(2,'app/page.tsx',page('staging').replace(' userName=', ' disabled="true" userName='));refuses('Staging dashboard functionality changed','app/page.tsx');put(2,'app/page.tsx',page('staging'));
 put(1,'app/page.tsx',page('staging'));refuses('Accidentally swapped Doomsday environment label','app/page.tsx');put(1,'app/page.tsx',page('doomsday'));
 put(0,'app/page.tsx',page('live').replace('return <Dashboard','return <div>Unauthorized</div><Dashboard'));refuses('LIVE home authorization/DOM drift','app/page.tsx');put(0,'app/page.tsx',page('live'));
 put(2,'app/chatgpt-auth.ts','Weaker staging authentication');refuses('LIVE/staging owner-gate drift','app/chatgpt-auth.ts');put(2,'app/chatgpt-auth.ts','Identical protected Sites authentication');
 put(1,'app/chatgpt-auth.ts','export {getChatGPTUser} from "./sites-header-auth";');refuses('Doomsday silently uses Sites auth','app/chatgpt-auth.ts');put(1,'app/chatgpt-auth.ts',bridge);
 put(2,'app/local-customer-deployment.ts',"/** Fixed server deployment adapter. */\nexport const LOCAL_CUSTOMER_DEPLOYMENT = 'live' as const;\n");refuses('Installed app namespace collision','app/local-customer-deployment.ts');put(2,'app/local-customer-deployment.ts',"/** Fixed server deployment adapter. */\nexport const LOCAL_CUSTOMER_DEPLOYMENT = 'staging' as const;\n");
 unlinkSync(join(dirs[1],'app/owner-auth.ts'));refuses('Doomsday owner auth implementation missing','app/owner-auth.ts');put(1,'app/owner-auth.ts','Independent signed owner session adapter');
 passes('All fixtures restored to verified strict source parity');
 console.log('PASS: REAL three-target parity gate catches root iPhone/layout, dashboard, authentication, home-page identity, missing CSS/owner auth and shared hook drift; permits only exact reviewed environment/auth adapter differences.');
}finally{rmSync(root,{recursive:true,force:true});}
