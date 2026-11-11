import fs from "node:fs";
const m=JSON.parse(fs.readFileSync(new URL("../PARITY_EVIDENCE_MANIFEST.json", import.meta.url),"utf8"));
const entries=m.entries||[];
const bad=entries.filter(e=>!e.capture_group);
const groups=[...new Set(entries.map(e=>e.capture_group).filter(Boolean))];
if(bad.length) { console.error(`FAIL: ${bad.length} evidence entries missing capture_group`); process.exit(1); }
if(groups.length!==11) { console.error(`FAIL: expected 11 capture groups, found ${groups.length}`); process.exit(1); }
console.log(`PASS: ${entries.length}/${entries.length} evidence entries mapped across ${groups.length} optimized capture groups`);
