import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('calculator');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const loader=read('full-v18.js');
const index=read('index.html');
const sw=read('sw.js');

const versioned=s=>new Set([...s.matchAll(/['"`](\.\/[^'"`?]+\?v=\d+)['"`]/g)].map(m=>m[1]));
const loaderUrls=versioned(loader);
const swUrls=versioned(sw);
const entryMatch=index.match(/<script[^>]+src=["'](\.\/full-v18\.js\?v=\d+)["']/i);
if(!entryMatch)throw new Error('index.html is missing a versioned full-v18.js entry script');
const required=new Set([entryMatch[1],...loaderUrls]);
const missing=[...required].filter(x=>!swUrls.has(x));
const stale=[];

for(const url of required){
  const file=url.replace(/^\.\//,'').replace(/\?v=\d+$/,'');
  if(!fs.existsSync(path.join(root,file)))throw new Error(`Loader references missing calculator asset: ${url}`);
}

const currentByFile=new Map([...required].map(url=>[url.replace(/^\.\//,'').replace(/\?v=\d+$/,''),url]));
for(const url of swUrls){
  const file=url.replace(/^\.\//,'').replace(/\?v=\d+$/,'');
  const expected=currentByFile.get(file);
  if(expected&&expected!==url)stale.push({file,cached:url,expected});
}

if(missing.length||stale.length){
  console.error(JSON.stringify({missing,stale},null,2));
  process.exit(1);
}

const cacheMatch=sw.match(/const CACHE=['"]([^'"]+)['"]/);
if(!cacheMatch)throw new Error('sw.js is missing a named cache generation');
console.log(`OFFLINE CACHE CONTRACT PASS cache=${cacheMatch[1]} assets=${required.size}`);
