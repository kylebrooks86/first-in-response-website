import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root=path.resolve(new URL("..",import.meta.url).pathname);
const outputArg=process.argv[2];
if(!outputArg)throw new Error("Usage: node scripts/build-release-package.mjs <output.zip>");
const output=path.resolve(outputArg);
const policy=JSON.parse(fs.readFileSync(path.join(root,"RELEASE_PACKAGE_POLICY.json"),"utf8"));
const current=JSON.parse(fs.readFileSync(path.join(root,"CURRENT_VERSION.json"),"utf8"));
if(policy.fire_release!==current.fire_release)throw new Error(`Package policy release ${policy.fire_release} does not match current release ${current.fire_release}`);

const excludeDir=new Set(policy.exclude_directories||[]);
const excludeFile=new Set(policy.exclude_filenames||[]);
const keepCurrent=new Set(policy.keep_current_versioned_artifacts||[]);
const versioned=(policy.exclude_top_level_versioned_patterns||[]).map((pattern)=>new RegExp(pattern));

const files=[];
const walk=(dir,rel="")=>{
  for(const name of fs.readdirSync(dir).sort()){
    const abs=path.join(dir,name);
    const childRel=rel?`${rel}/${name}`:name;
    const stat=fs.statSync(abs);
    if(stat.isDirectory()){
      if(excludeDir.has(name))continue;
      walk(abs,childRel);
      continue;
    }
    if(!stat.isFile())continue;
    if(excludeFile.has(name))continue;
    if(!rel){
      const isVersioned=versioned.some((rx)=>rx.test(name));
      if(isVersioned&&!keepCurrent.has(name))continue;
    }
    files.push(childRel);
  }
};
walk(root);

for(const required of keepCurrent){
  if(!files.includes(required))throw new Error(`Current versioned artifact missing from package set: ${required}`);
}
if(files.includes(path.basename(output)))throw new Error("Output ZIP cannot be included in itself.");

fs.mkdirSync(path.dirname(output),{recursive:true});
if(fs.existsSync(output))fs.unlinkSync(output);
const listPath=path.join(root,".release-package-files.txt");
fs.writeFileSync(listPath,files.join("\n")+"\n");
try{
  execFileSync("zip",["-q","-X",output,"-@"],{cwd:root,input:files.join("\n")+"\n",stdio:["pipe","inherit","inherit"]});
}finally{
  if(fs.existsSync(listPath))fs.unlinkSync(listPath);
}
console.log(`PASS  Canonical release package built: ${files.length} files -> ${output}`);
