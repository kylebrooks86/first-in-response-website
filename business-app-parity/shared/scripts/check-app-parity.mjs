import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const roots=process.argv.slice(2).map(path=>resolve(path));
if(roots.length<2)throw Error('Usage: node scripts/check-app-parity.mjs LIVE_CANDIDATE DR_CANDIDATE [STAGING_CANDIDATE]');
// Explicit target adapters: these require separate release verification.
const adapters=new Set(['app/page.tsx','app/layout.tsx','app/chatgpt-auth.ts','app/owner-auth.ts','app/login/page.tsx','app/api/auth/login/route.ts','app/api/auth/logout/route.ts','app/api/app-version/route.ts','app/api/staging-fixtures/route.ts']);
function inventory(root){const result=new Map();function walk(dir){if(!existsSync(dir))return;for(const entry of readdirSync(dir,{withFileTypes:true})){const p=join(dir,entry.name);if(entry.isDirectory())walk(p);else if(entry.isFile()){const path=relative(root,p);if(!adapters.has(path))result.set(path,createHash('sha256').update(readFileSync(p)).digest('hex'));}}}for(const folder of ['app','lib','components','db','public'])walk(join(root,folder));return result;}
const maps=roots.map(inventory);const paths=new Set(maps.flatMap(m=>[...m.keys()]));const differences=[];
for(const path of [...paths].sort()){const hashes=maps.map(m=>m.get(path)||null);if(new Set(hashes).size>1)differences.push({path,hashes});}
console.log(JSON.stringify({sharedFilesChecked:paths.size,roots,adaptersRequiringSeparateVerification:[...adapters],differences,sharedSourceParity:!differences.length,productionReady:false},null,2));
process.exitCode=differences.length?1:0;
