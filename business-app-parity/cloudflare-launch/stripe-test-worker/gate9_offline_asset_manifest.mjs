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
import {readdirSync, readFileSync, realpathSync, lstatSync} from 'node:fs';
import {basename, extname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyAssetManifest} from './gate9_inactive_fullapp_contract.mjs';

const EXT = new Set([
  '.js','.css','.html','.json','.webmanifest','.txt',
  '.png','.jpg','.jpeg','.webp','.gif','.svg','.ico',
  '.woff','.woff2','.ttf','.avif','.mp4','.webm'
]);
function insist(b) {
  if (!b) throw Error('STOP: Unsafe or incomplete local asset tree. NO upload.');
}
function compiledRoot(root) {
  const path=resolve(root);
  insist(basename(path)==='client' &&
    basename(resolve(path,'..'))==='dist');
  const actual=realpathSync(path);
  insist(actual===path); // no symlink for compiled root
  return path;
}
export function createLocalAssetManifest(root) {
  const base=compiledRoot(root);
  const manifest={};
  let count=0, bytes=0;
  function walk(folder,parents=[]) {
    insist(parents.length<20);
    for(const entry of readdirSync(folder,{withFileTypes:true})) {
      const name=entry.name;
      insist(/^[A-Za-z0-9._-]+$/.test(name) && name!=='.' && name!=='..' &&
        !name.startsWith('.') && !/password|secret|token|private|backup/i.test(name));
      const absolute=join(folder,name);
      const st=lstatSync(absolute);
      insist(!st.isSymbolicLink());
      if(st.isDirectory())walk(absolute,[...parents,name]);
      else {
        insist(st.isFile() && st.size>0 && st.size<25_000_000);
        const ext=extname(name).toLowerCase();
        insist(EXT.has(ext)); // no .map, .env, database or private keys
        const path='/'+[...parents,name].join('/');
        const buf=readFileSync(absolute);
        insist(buf.length===st.size);
        const hash=createHash('sha256')
          .update(buf.toString('base64')+ext.slice(1))
          .digest('hex').slice(0,32);
        insist(!Object.hasOwn(manifest,path));
        manifest[path]={hash,size:buf.length};
        count++;bytes+=buf.length;
        insist(count<=5000 && bytes<200_000_000);
      }
    }
  }
  walk(base);
  verifyAssetManifest(manifest);
  return manifest;
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
    console.log('PASS: Offline TEST full-app asset manifest shape/hash calculation');
    console.log('ASSETS_COUNT='+s.assetCount);
    console.log('TOTAL_BYTES='+s.assetBytes);
    console.log('METADATA_SHA256='+s.metadataSha256);
    console.log('LOCAL_ONLY=TRUE; NO UPLOAD, NO TOKEN, NO VERSION, NO DEPLOY.');
  }catch{
    console.error('STOP: Local TEST asset inventory failed. No remote changes.');
    process.exitCode=1;
  }
}
