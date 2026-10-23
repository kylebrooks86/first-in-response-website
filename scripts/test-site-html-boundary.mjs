/** Independent public-vs-private HTML audit boundary regression.
 * Source-only filesystem inventory, no website hosting or deployment access.
 */
import assert from "node:assert/strict";
import {readFileSync, readdirSync, statSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, join, relative, sep} from "node:path";
import {isWebsiteHtml, websiteHtmlFiles} from "./site-html-boundary.mjs";

const root=join(dirname(fileURLToPath(import.meta.url)),"..");
const walk=(dir)=>{
  const found=[];
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    if(entry.name===".git")continue;
    const absolute=join(dir,entry.name);
    if(entry.isDirectory())found.push(...walk(absolute));
    else found.push(relative(root,absolute).split(sep).join("/"));
  }
  return found;
};
const files=walk(root).filter(x=>x.endsWith(".html"));
const site=websiteHtmlFiles(files);
let n=0;
function same(actual,expected,label){assert.deepEqual(actual,expected,label);n++;console.log("PASS:",label);}
function yes(condition,label){assert.ok(condition,label);n++;console.log("PASS:",label);}
const marketing=[
  "index.html","404.html","terms/index.html","privacy/index.html",
  "recent-work/index.html","review/index.html","service-terms/index.html",
  "services/concrete-cleaning/index.html","services/dryer-vent-cleaning/index.html",
  "services/fence-deck-cleaning/index.html","services/gutter-cleaning/index.html",
  "services/house-washing/index.html","services/roof-cleaning/index.html",
  "services/rust-stain-removal/index.html","services/underground-drain-cleaning/index.html",
  "services/window-cleaning/index.html",
];
same([...site].sort(),[...marketing].sort(),"all 16 actual public website HTML files remain audited");
same(site.filter(x=>x!=="404.html"&&x!=="terms/index.html").length,14,
 "all 14 canonical marketing pages still verified");
const previews=[
 "business-app-parity/shared/scripts/local-customer-demo.html",
 "business-app-parity/shared/synthetic-customers-preview/index.html",
 "calculator/index.html",
];
for(const p of previews){
 yes(files.includes(p),"tracked source fixture exists: "+p);
 same(isWebsiteHtml(p),false,"private app or calculator fixture is not a website page: "+p);
}
for(const p of [
 "index.html","services/new-service/index.html","privacy/new.html","new-marketing/index.html",
 "other-site/index.html","404.html","terms/index.html",
]){
 same(isWebsiteHtml(p),true,"public-looking HTML remains verified, including new/unknown pages: "+p);
}
same(websiteHtmlFiles([...files,"new-marketing/index.html"]).length,site.length+1,
 "unapproved new marketing page is not silently excluded from 14-page guard");
same(websiteHtmlFiles([...files,"business-app-parity/new-qa/index.html"]).length,site.length,
 "a new app fixture cannot inflate the public sitemap page inventory");
yes(readFileSync(join(root,"verify-site.mjs"),"utf8")
    .includes("const siteHtmlFiles = websiteHtmlFiles(htmlFiles);"),
 "the REAL verifier uses the tested boundary");
yes(readFileSync(join(root,"verify-site.mjs"),"utf8")
    .includes("const mediaIntegrityErrors = [];"),
 "original website media signature checks remain present");
yes(readFileSync(join(root,"verify-site-ci.mjs"),"utf8")
    .includes("const expectedBlobs = {"),
 "existing exact-byte masonry exception stays independently pinned");
console.log("PASS "+n+"/"+n+" page-scope assertions; no deployed site or original photos modified.");
