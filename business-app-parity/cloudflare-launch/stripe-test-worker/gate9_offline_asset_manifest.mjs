/**
 * FIRE Gate9 FULL APP static asset manifest: LOCAL read-only file inspection.
 * Cloudflare direct-upload manifest hash: first 32 hex chars SHA256(base64(file)+extension).
 * https://developers.cloudflare.com/workers/static-assets/direct-upload/
 *
 * Does not upload assets, request upload tokens, write a manifest, contact
 * Cloudflare, enable payments, or build a deployable Worker. Never pass
 * production/customer/credential directories. Only accepts dist/client.
 */
import {createHash} from 'node:crypto';
import {readdirSync, readFileSync, realpathSync, lstatSync, existsSync} from 'node:fs';
import {basename, extname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyAssetManifest} from './gate9_inactive_fullapp_contract.mjs';

const EXT = new Set([
  '.js','.css','.html','.json','.webmanifest','.txt',
  '.png','.jpg','.jpeg','.webp','.gif','.svg','.ico',
  '.woff','.woff2','.ttf','.avif','.mp4','.webm'
]);
function insist(b, code='CONTRACT') {
  if (!b) throw Error('STOP: Local TEST asset inventory ['+code+']. NO upload.');
}
function compiledRoot(root) {
  const path=resolve(root);
  insist(basename(path)==='client' &&
    basename(resolve(path,'..'))==='dist','ROOT_NOT_DIST_CLIENT');
  const actual=realpathSync(path);
  insist(actual===path,'ROOT_SYMLINK'); // no symlink for compiled root
  return path;
}
export function createLocalAssetManifest(root) {
  const base=compiledRoot(root);
  const manifest={};
  let count=0, bytes=0;
  function walk(folder,parents=[]) {
    insist(parents.length<20,'NESTING');
    for(const entry of readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)) {
      const name=entry.name;
      // Vite emits two private build-control entries at dist/client root.
      // They are NOT public site assets and must never be uploaded.
      // Reject all other hidden entries, symlinks or unexpected shapes.
      if (parents.length === 0 && name === '.vite' && entry.isDirectory()) continue;
      if (parents.length === 0 && name === '.assetsignore' && entry.isFile()) continue;
      // Cloudflare requires these exact extensionless control files as
      // text/plain Worker modules, NEVER ordinary static asset manifest items.
      if (parents.length === 0 && ['_headers','_redirects'].includes(name) && entry.isFile()) continue;
      insist(!name.startsWith('.'),'DOT_ENTRY');
      insist(/^[A-Za-z0-9._-]+$/.test(name),'FILENAME_CHARSET');
      const absolute=join(folder,name);
      const st=lstatSync(absolute);
      insist(!st.isSymbolicLink(),'SYMLINK');
      if(st.isDirectory())walk(absolute,[...parents,name]);
      else {
        insist(st.isFile() && st.size>0 && st.size<25_000_000,'FILE_TYPE_OR_SIZE');
        const ext=extname(name).toLowerCase();
        insist(EXT.has(ext),'EXTENSION'); // no .map, .env, database or private keys
        const path='/'+[...parents,name].join('/');
        const buf=readFileSync(absolute);
        insist(buf.length===st.size,'FILE_CHANGED');
        // Do not reject ordinary bundle names containing words like private.
        // Instead refuse any actual long, credential-shaped value in the
        // bytes. Source-code regexes mentioning a key PREFIX alone are fine.
        const text=buf.toString('utf8');
        insist(!/(?:sk|rk|rkcs)_(?:live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}/.test(text),
          'EMBEDDED_CREDENTIAL_SHAPE');
        const hash=createHash('sha256')
          .update(buf.toString('base64')+ext.slice(1))
          .digest('hex').slice(0,32);
        insist(!Object.hasOwn(manifest,path),'DUPLICATE');
        manifest[path]={hash,size:buf.length};
        count++;bytes+=buf.length;
        insist(count<=5000 && bytes<200_000_000,'ASSET_BUDGET');
      }
    }
  }
  walk(base);
  try { verifyAssetManifest(manifest); }
  catch { throw Error('STOP: Local TEST asset inventory [MANIFEST_SHAPE]. NO upload.'); }
  return manifest;
}
export function inspectSpecialWorkerModules(root) {
  const folder=compiledRoot(root);
  const result=[];
  for(const name of ['_headers','_redirects']) {
    const abs=join(folder,name);
    if(!existsSync(abs))continue;
    const stat=lstatSync(abs);
    insist(stat.isFile() && !stat.isSymbolicLink() &&
      stat.size>0 && stat.size<65_536,'SPECIAL_MODULE_FILE');
    const bytes=readFileSync(abs);
    insist(bytes.length===stat.size &&
      !/(?:sk|rk|rkcs)_(?:live|test)_|whsec_|CLOUDFLARE_API_TOKEN/i.test(bytes.toString('utf8')),
      'SPECIAL_MODULE_CONTENT');
    result.push({
      name,contentType:'text/plain',bytes:stat.size,
      sha256:createHash('sha256').update(bytes).digest('hex')
    });
  }
  return result;
}
export function safeLocalManifestSummary(manifest) {
  const {assetCount,assetBytes}=verifyAssetManifest(manifest);
  const digest=createHash('sha256')
    .update(JSON.stringify(Object.keys(manifest).sort().map(k=>[k,manifest[k]])))
    .digest('hex');
  return {assetCount,assetBytes,metadataSha256:digest,
    assetsUploaded:false,versionCreated:false,gate9Accepted:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{
    insist(process.argv.length===3);
    const m=createLocalAssetManifest(process.argv[2]);
    const s=safeLocalManifestSummary(m);
    const special=inspectSpecialWorkerModules(process.argv[2]);
    console.log('PASS: Offline TEST full-app asset manifest shape/hash calculation');
    console.log('ASSETS_COUNT='+s.assetCount);
    console.log('TOTAL_BYTES='+s.assetBytes);
    console.log('METADATA_SHA256='+s.metadataSha256);
    for(const item of special)console.log('SEPARATE_WORKER_TEXT_MODULE='+item.name+' SHA256='+item.sha256);
    console.log('SEPARATE_WORKER_MODULES_COUNT='+special.length);
    console.log('LOCAL_ONLY=TRUE; NO UPLOAD, NO TOKEN, NO VERSION, NO DEPLOY.');
  }catch(error){
    console.error(error instanceof Error && /^STOP: Local TEST asset inventory \[[A-Z_]+\]/.test(error.message) ? error.message : 'STOP: Local TEST asset inventory [UNKNOWN]. No remote changes.');
    process.exitCode=1;
  }
}
