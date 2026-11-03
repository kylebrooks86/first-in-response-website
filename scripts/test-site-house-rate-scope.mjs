#!/usr/bin/env node
/** Synthetic checkout-only test of the website pricing audit scope.
 * The temp file and public page mutation exist ONLY within the CI checkout
 * and are always restored. This never changes a LIVE website or app price.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const page=path.join(root,'services/house-washing/index.html');
const fixture=path.join(root,'business-app-parity/FIRE_CI_OWNER_RATE_OVERRIDE_SYNTHETIC_ONLY.md');
const original=fs.readFileSync(page,'utf8');
assert.ok(!fs.existsSync(fixture),'Never overwrite any actual app file');
assert.ok(!original.includes('<!-- FIRE-CI-RATE-SCOPE-INJECTION -->'),'Unexpected preexisting synthetic marker');
function audit(){
  const r=spawnSync(process.execPath,['verify-site.mjs'],{cwd:root,encoding:'utf8',timeout:30000});
  assert.ok(!r.error,'Website verifier process failed unexpectedly: '+String(r.error));
  return [r.stdout||'',r.stderr||''].join('\n');
}
try{
  fs.writeFileSync(fixture,'Synthetic owner-selected job quote at $0.25/sq ft; published default stays $0.22.\n',{flag:'wx'});
  const allowed=audit();
  assert.ok(allowed.includes('PASS: No superseded house-wash rate remains in public website pricing or BUSINESS_RULES.md.'),
    'Legitimate private app quote example must not fail the public marketing price audit');
  fs.writeFileSync(page,original+'\n<!-- FIRE-CI-RATE-SCOPE-INJECTION -->\n<!-- Public website wrongly advertises $0.25 as starting house-wash rate. -->\n');
  const rejected=audit();
  assert.ok(rejected.includes('A superseded house-wash rate remains in public website pricing: services/house-washing/index.html.'),
    'Actual public house-wash page with obsolete advertised base rate MUST fail and name offending file');
  console.log('PASS: Private FIRE app $0.25 override does not break website CI; synthetic public $0.25 base fails closed. No site change persists.');
}finally{
  fs.writeFileSync(page,original);
  fs.rmSync(fixture,{force:true});
}
