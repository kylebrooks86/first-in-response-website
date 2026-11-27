/**
 * Remove obsolete Cloudflare legacy_env from ONLY the built independent-STAGING
 * Wrangler manifest. Wrangler >=4.111 rejects the field even if its value is
 * false. The Vite build currently emits it despite no source request.
 * Source-only packaging compatibility; never calls Cloudflare or uploads.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,renameSync,unlinkSync} from 'node:fs';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verify} from './check_independent_staging_runtime_config.mjs';

export function stripObsoleteLegacyEnv(config) {
  assert.ok(config&&typeof config==='object'&&!Array.isArray(config),
    'STAGING Wrangler manifest must be an object');
  // Fail-closed source identity and safety before touching the generated file.
  verify(config);
  const changed=Object.hasOwn(config,'legacy_env');
  if(changed){
    assert.equal(typeof config.legacy_env,'boolean',
      'Unrecognized legacy_env value');
  }
  const clean={...config};
  delete clean.legacy_env;
  verify(clean);
  assert.equal(Object.hasOwn(clean,'legacy_env'),false);
  return {clean,changed};
}

export function sanitizeBuiltStagingManifest(path){
  const resolved=resolve(path);
  assert.equal(basename(resolved),'wrangler.json','Only Wrangler JSON allowed');
  assert.equal(basename(dirname(resolved)),'server','Expected dist/server');
  assert.equal(basename(dirname(dirname(resolved))),'dist','Expected dist/server');
  const raw=readFileSync(resolved,'utf8');
  const {clean,changed}=stripObsoleteLegacyEnv(JSON.parse(raw));
  if(!changed)return false;
  const tmp=join(dirname(resolved),'.fire-staging-compat-'+process.pid+'.tmp');
  try {
    writeFileSync(tmp,JSON.stringify(clean,null,2)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
    renameSync(tmp,resolved);
  }finally{
    try{unlinkSync(tmp)}catch(error){if(error?.code!=='ENOENT')throw error}
  }
  return true;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    assert.equal(process.argv.length,3,'Provide one compiled STAGING wrangler.json path');
    const changed=sanitizeBuiltStagingManifest(process.argv[2]);
    console.log(changed?'FIRE_STAGING_LEGACY_ENV_COMPAT_REMOVED_LOCAL_ONLY':
      'FIRE_STAGING_LEGACY_ENV_ALREADY_ABSENT_LOCAL_ONLY');
    console.log('No provider contact, Cloudflare login, deployment or upload.');
  }catch{
    console.error('FIRE_STAGING_LEGACY_ENV_COMPAT_STOP: local manifest unchanged or invalid.');
    process.exitCode=1;
  }
}
