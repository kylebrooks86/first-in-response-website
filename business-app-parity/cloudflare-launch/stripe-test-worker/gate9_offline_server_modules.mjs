/**
 * FIRE Gate 9 — compiled server entrypoint/module identity, entirely OFFLINE.
 * Reads only a TEST-local dist/server tree produced by the isolated builder.
 * No provider API, auth, secrets, database, uploads, output file or writes.
 *
 * It proves a compiled JS entrypoint exists, inventories local compiled
 * module bytes, and checks the generated Vite manifest against the known
 * fake/local-only DB before deriving the separate TEST-only review manifest.
 * The digest is for reproducibility, NOT a deployable API payload.
 */
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync,lstatSync,realpathSync} from 'node:fs';
import {basename,extname,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareStripeTestManifest} from './prepare-stripe-test-manifest.mjs';

function need(condition,reason='SHAPE'){
  if(!condition)throw Error('STOP: FIRE TEST compiled server ['+reason+']; NO upload.');
}
const HEX=/^[0-9a-f]{64}$/;
const ALLOWED=new Set(['.js','.mjs','.cjs','.wasm','.json']);
function distServer(root){
  const dir=resolve(root);
  need(basename(dir)==='server' &&
       basename(resolve(dir,'..'))==='dist','DIST_SERVER_ONLY');
  need(realpathSync(dir)===dir,'SYMLINK_ROOT');
  return dir;
}
export function inventoryCompiledModules(root,main) {
  const dir=distServer(root);
  need(typeof main==='string' && main.length>0 && main.length<260 &&
    !main.startsWith('/') && !main.includes('\\') &&
    !main.split('/').includes('..') && /\.(m?js|cjs)$/.test(main),
    'ENTRY_RELATIVE_MODULE');
  const entry=resolve(dir,main),rel=relative(dir,entry);
  need(rel!=='' && rel!=='..' && !rel.startsWith('..'+sep) &&
    !rel.startsWith(sep), 'ENTRY_ESCAPE');
  const records=[];
  let count=0,total=0;
  const visit=(folder,depth=0)=>{
    need(depth<20,'TREE_DEPTH');
    for(const file of readdirSync(folder,{withFileTypes:true})){
      const full=join(folder,file.name);
      const stat=lstatSync(full);
      need(!stat.isSymbolicLink(),'SYMLINK');
      if(stat.isDirectory()){
        if(depth===0 && file.name==='.vite')continue; // private build metadata only
        need(!file.name.startsWith('.') && file.name!=='node_modules','DIR_SHAPE');
        visit(full,depth+1);
        continue;
      }
      need(stat.isFile() && stat.size>0 && stat.size<80_000_000,'MODULE_FILE');
      const name=relative(dir,full).replaceAll('\\','/');
      if(name==='wrangler.json')continue; // reviewed separately as local-only config
      if(name==='wrangler.FIRE_TEST_REVIEW_ONLY.json')continue;
      const ext=extname(name).toLowerCase();
      if(ext==='.map')continue; // debug source maps not runtime executable modules
      need(ALLOWED.has(ext),'MODULE_EXTENSION');
      const bytes=readFileSync(full);
      need(bytes.length===stat.size,'MODULE_CHANGED');
      const hash=createHash('sha256').update(bytes).digest('hex');
      need(HEX.test(hash),'HASH');
      records.push([name,bytes.length,hash]);
      count++;total+=bytes.length;
      need(count<=5000&&total<200_000_000,'MODULE_BUDGET');
    }
  };
  visit(dir);
  need(records.length>0,'MISSING_MODULES');
  const mainRecord=records.find(([name])=>name===main.replace(/^\.\//,''));
  need(mainRecord && mainRecord[1]>200,'MISSING_ENTRYPOINT');
  records.sort((a,b)=>a[0].localeCompare(b[0]));
  return {
    moduleCount:records.length,totalBytes:total,
    mainModule:mainRecord[0],mainSha256:mainRecord[2],
    modulesDigest:createHash('sha256').update(JSON.stringify(records)).digest('hex'),
    unreviewedCloudflareUploadContract:true,
    uploaded:false, deployed:false, gate9Accepted:false
  };
}
export function inspectCompiledServer(root){
  const dir=distServer(root);
  const source=JSON.parse(readFileSync(join(dir,'wrangler.json'),'utf8'));
  // Requires the fake local DB and local BUCKET placeholder before deriving
  // TEST-only mappings. Never pass a hosted/production manifest to this step.
  const review=prepareStripeTestManifest(source);
  need(review.vars?.FIRE_STRIPE_MODE==='disabled' &&
    review.d1_databases?.length===1 &&
    !Object.hasOwn(review,'r2_buckets') && review.name==='fire-stripe-test-20261101',
    'TEST_SOURCE_CONFIG');
  const modules=inventoryCompiledModules(dir,source.main);
  return {...modules, compiledFakeDatabaseOnly:true,
    testReviewNoR2:true,testStripeDisabled:true};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    need(process.argv.length===3,'ARGS');
    const out=inspectCompiledServer(process.argv[2]);
    console.log('PASS: Local TEST full-app server entrypoint and module inventory');
    console.log('SERVER_MODULE_COUNT='+out.moduleCount);
    console.log('SERVER_MODULE_TOTAL_BYTES='+out.totalBytes);
    console.log('SERVER_MAIN_SHA256='+out.mainSha256);
    console.log('SERVER_MODULE_MANIFEST_SHA256='+out.modulesDigest);
    console.log('GENERATED_SOURCE_D1=FAKE_PLACEHOLDER_ONLY; TEST_REVIEW_STRIPE_DISABLED=TRUE; R2=NONE');
    console.log('NO MODULE_UPLOAD, VERSION_CREATION, DEPLOYMENT OR PROVIDER CALL.');
  }catch(err){
    const m=err instanceof Error && /^STOP: FIRE TEST compiled server \[[A-Z_]+\]/.test(err.message)
      ? err.message
      : 'STOP: FIRE TEST compiled server [UNVERIFIED]. NO upload.';
    console.error(m);
    process.exitCode=1;
  }
}
