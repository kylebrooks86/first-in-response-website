// Targeted offline-only fail-closed entrypoint checks; NO secrets/network or Cloudflare calls.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const script=join(dirname(fileURLToPath(import.meta.url)),'owner_gate9_activation_inactive_once_20261125.mjs');
const cleanEnv={PATH:process.env.PATH,SYSTEMROOT:process.env.SYSTEMROOT,TEMP:process.env.TEMP,TMP:process.env.TMP};
const run=args=>spawnSync(process.execPath,[script,...args],{env:cleanEnv,encoding:'utf8',timeout:12000});
const empty=run([]);
assert.equal(empty.status,1);
assert.match(empty.stderr,/G9_ONCE_STOP_PACKAGE_PATH/);
const rel=run(['relative-review-folder']);
assert.equal(rel.status,1);
assert.match(rel.stderr,/G9_ONCE_STOP_PACKAGE_PATH/);
const root=mkdtempSync(join(tmpdir(),'fire-g9-owner-cli-'));
try{
  const bad=run([root]);
  assert.equal(bad.status,1);
  assert.match(bad.stderr,/G9_ONCE_STOP_UNVERIFIED/);
  const fake={sourceSha:'33f24500d9b6af665c4fa1e2e1e588e92227c70e',
    worker:'fire-stripe-test-20261101',d1:'dba421ba-fc66-4cf8-9c31-51616f8249ba',
    account:'acct_1ULRIG7ND12rd1wI',rollbackVersion:'96e32262-fa33-4f04-a161-bee11f0353e2'};
  writeFileSync(join(root,'activation-review-receipt.json'),JSON.stringify(fake));
  const noCred=run([root]);
  assert.equal(noCred.status,1);
  assert.match(noCred.stderr,/G9_ONCE_STOP_CLOUDFLARE_TOKEN/);
  assert.equal(noCred.stdout,'');
}finally{rmSync(root,{recursive:true,force:true})}
console.log('G9_ONCE_CLI_OFFLINE_GUARDS_PASS; no provider calls');
