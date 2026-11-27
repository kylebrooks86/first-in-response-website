import fs from "node:fs";
import path from "node:path";

const root=path.resolve(new URL("..",import.meta.url).pathname);
const current=JSON.parse(fs.readFileSync(path.join(root,"CURRENT_VERSION.json"),"utf8"));
const release=current.fire_release;

const read=(rel)=>{
  const p=path.join(root,rel);
  if(!fs.existsSync(p))throw new Error(`Missing current recovery doc: ${rel}`);
  return fs.readFileSync(p,"utf8");
};
const docs={
  readme:read("README.md"),
  goNoGo:read("GO_NO_GO.md"),
  security:read("SECURITY_AND_RECOVERY_STATUS.md"),
  deployment:read("INDEPENDENT_DEPLOYMENT.md"),
  acceptance:read("STAGING_ACCEPTANCE_TEST.md"),
  releaseStatus:read("RELEASE_STATUS.md")
};

const failures=[];
const requireText=(name,text,needle)=>{if(!text.includes(needle))failures.push(`${name} missing required current text: ${needle}`);};
const forbid=(name,text,regex,label)=>{if(regex.test(text))failures.push(`${name} contains stale/forbidden guidance: ${label}`);};

requireText("README",docs.readme,`FIRE App ${release}`);
requireText("GO_NO_GO",docs.goNoGo,`FIRE App ${release}`);
requireText("SECURITY_AND_RECOVERY_STATUS",docs.security,"21 contiguous migrations: 0000 through 0020");
requireText("INDEPENDENT_DEPLOYMENT",docs.deployment,`release candidate ${release}`);
requireText("STAGING_ACCEPTANCE_TEST",docs.acceptance,"intentional owner exception");
requireText("RELEASE_STATUS",docs.releaseStatus,`Current release: **${release}`);

for(const [name,text] of Object.entries(docs)){
  forbid(name,text,/npm\s+run\s+parity:evidence:intake/i,"disabled legacy parity:evidence:intake command");
}
forbid("README",docs.readme,/v27\b/i,"old v27 baseline");
forbid("GO_NO_GO",docs.goNoGo,/Release candidate:\s*v14\b/i,"old v14 candidate status");
forbid("SECURITY_AND_RECOVERY_STATUS",docs.security,/migrations?\s+`?0000`?\s+through\s+`?0009`?/i,"obsolete migration range 0000-0009");
forbid("INDEPENDENT_DEPLOYMENT",docs.deployment,/release candidate v124\b/i,"old v124 runbook header");
forbid("STAGING_ACCEPTANCE_TEST",docs.acceptance,/live-v49|v29\+/i,"obsolete parity/schedule version labels");
forbid("STAGING_ACCEPTANCE_TEST",docs.acceptance,/cannot be scheduled before the full 50% deposit|remains unschedulable until the full required 50% deposit/i,"obsolete no-exception scheduling rule");

if(failures.length){
  for(const failure of failures)console.error(`FAIL  ${failure}`);
  console.error(`Current recovery-doc freshness failed: ${failures.length} issue(s).`);
  process.exit(1);
}
console.log(`PASS  Current recovery docs aligned to ${release}; scheduling exception, migrations, and parity workflow are current.`);
