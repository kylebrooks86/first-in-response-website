/** Fail closed on source-level visual/function drift across three FIRE app builds.
 * This checks local, fully materialized candidates; it is NOT hosted or physical-iPhone proof.
 * Only the explicit environment tag and independent Doomsday auth may differ.
 */
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';

if(process.argv.length!==5)throw Error('Usage: node scripts/check-app-parity.mjs LIVE_CANDIDATE DOOMSDAY_CANDIDATE STAGING_CANDIDATE');
const targets=['live','doomsday','staging'];
const roots=process.argv.slice(2).map(path=>resolve(path));
// app/layout.tsx MUST be compared: visual styles, viewport, PWA metadata
// and top-level DOM must not accidentally diverge by deployment.
const adapters=new Set([
 'app/page.tsx','app/local-customer-deployment.ts','app/chatgpt-auth.ts',
 'app/owner-auth.ts','app/login/page.tsx','app/api/auth/login/route.ts',
 'app/api/auth/logout/route.ts','app/api/app-version/route.ts',
 'app/api/staging-fixtures/route.ts'
]);
function inventory(root){
 const result=new Map();
 function walk(dir){
  if(!existsSync(dir))return;
  for(const entry of readdirSync(dir,{withFileTypes:true})){
   const file=join(dir,entry.name);
   if(entry.isDirectory())walk(file);
   else if(entry.isFile()){
    const path=relative(root,file).replaceAll('\\','/');
    if(!adapters.has(path))result.set(path,createHash('sha256').update(readFileSync(file)).digest('hex'));
   }
  }
 }
 for(const folder of ['app','lib','components','db','public','hooks','vendor'])walk(join(root,folder));
 return result;
}
const differences=[];
function requireFile(index,path){
 const full=join(roots[index],path);
 if(!existsSync(full)){differences.push({path,target:targets[index],reason:'Required entry file missing'});return null;}
 return readFileSync(full,'utf8');
}
const maps=roots.map(inventory),paths=new Set(maps.flatMap(m=>[...m.keys()]));
for(const path of [...paths].sort()){
 const hashes=maps.map(m=>m.get(path)??null);
 if(new Set(hashes).size>1)differences.push({path,targets,hashes,reason:'Core business/UI source differs'});
}
for(const essential of ['app/layout.tsx','app/dashboard.tsx','app/manifest.ts','app/globals.css']){
 if(!maps.every(m=>m.has(essential)))differences.push({path:essential,reason:'Essential shared visual/functional entry absent'});
}
// Compare all home-page bytes, permitting ONLY one exact environment badge
// passed into the shared dashboard. Never exempt the whole home page from
// parity: otherwise owner protection, navigation or layout can silently drift.
const pages=roots.map((_,i)=>requireFile(i,'app/page.tsx'));
if(pages.every(page=>page!==null)){
 const live=pages[0];
 if(live.includes(' environment=')||!live.includes('return <Dashboard ')){
  differences.push({path:'app/page.tsx',target:'live',reason:'LIVE dashboard entry must have no environment override'});
 }
 for(const [i,label] of [[1,'DOOMSDAY'],[2,'STAGING']]){
  const marker=' environment="'+label+'"';
  const count=pages[i].split(marker).length-1;
  if(count!==1||pages[i].replace(marker,'')!==live){
   differences.push({path:'app/page.tsx',target:targets[i],reason:'Home page differs beyond its single reviewed environment label'});
  }
 }
}
for(const [i,target] of targets.entries()){
 const identity=requireFile(i,'app/local-customer-deployment.ts');
 if(identity!==null&&identity.trim()!=="export const LOCAL_CUSTOMER_DEPLOYMENT = '"+target+"' as const;"){
  differences.push({path:'app/local-customer-deployment.ts',target,reason:'Incorrect installed-app namespace'});
 }
}
// LIVE and staging use identical Sites owner auth. Doomsday deliberately
// uses the independent secure session adapter; its gateway bridge must be
// exactly the reviewed binding rather than a copy of Sites header auth.
const auth=roots.map((_,i)=>requireFile(i,'app/chatgpt-auth.ts'));
if(auth[0]!==null&&auth[2]!==null&&auth[0]!==auth[2]){
 differences.push({path:'app/chatgpt-auth.ts',reason:'LIVE and staging owner authentication diverged'});
}
const independentBridge='export { getOwnerUser as getChatGPTUser, requireOwnerUser as requireChatGPTUser, ownerSignInPath as chatGPTSignInPath, ownerSignOutPath as chatGPTSignOutPath } from "./owner-auth";';
if(auth[1]!==null&&auth[1].trim()!=='// Independent deployment adapter; never trusts Sites authentication headers.\n'+independentBridge){
 differences.push({path:'app/chatgpt-auth.ts',target:'doomsday',reason:'Independent auth bridge changed or trusts Sites headers'});
}
if(!existsSync(join(roots[1],'app/owner-auth.ts'))){
 differences.push({path:'app/owner-auth.ts',target:'doomsday',reason:'Independent owner-auth implementation missing'});
}
const result={sharedFilesChecked:paths.size,targets,roots,
 exactVisualLayoutAndDashboardEntry:!differences.some(x=>x.path==='app/layout.tsx'||x.path==='app/page.tsx'),
 distinctInstalledAppIdentities:!differences.some(x=>x.path==='app/local-customer-deployment.ts'),
 adapterAuthBoundaryChecked:true,sharedSourceParity:differences.length===0,
 differences,hostedVersionsCompared:false,physicalIphoneVerified:false,productionReady:false};
console.log(JSON.stringify(result,null,2));
if(differences.length)process.exitCode=1;
