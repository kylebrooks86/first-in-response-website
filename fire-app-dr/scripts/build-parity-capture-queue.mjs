import fs from "node:fs";
import path from "node:path";

const root=path.resolve(new URL("..",import.meta.url).pathname);
const manifest=JSON.parse(fs.readFileSync(path.join(root,"PARITY_EVIDENCE_MANIFEST.json"),"utf8"));
const out=path.join(root,"PARITY_CAPTURE_QUEUE.md");

const entries=manifest.entries||[];
const independent=entries.filter((entry)=>!(entry.evidence||[]).some((item)=>item.side==="independent"));
const live=entries.filter((entry)=>!(entry.evidence||[]).some((item)=>item.side==="live"));

const lines=[
  `# FIRE ${manifest.fire_release} — Parity Capture Queue`,
  "",
  `Generated from \`PARITY_EVIDENCE_MANIFEST.json\`.`,
  "",
  `- Total states: **${entries.length}**`,
  `- Independent screenshots still needed: **${independent.length}**`,
  `- LIVE screenshots still needed: **${live.length}**`,
  "",
  "## Independent capture — do these first",
  "",
];
for(const entry of independent){
  lines.push(`- [ ] \`${entry.id}\` — ${entry.state}  `);
  lines.push(`  Capture group: **${entry.capture_group||"unassigned"}**  `);
  lines.push(`  Independent source release required for identical verdict: **${manifest.fire_release}**  `);
  lines.push(`  Required shared-core fingerprint: **${manifest.shared_core_fingerprint_sha256}**  `);
  lines.push(`  Route family: **${entry.id}**  `);
  const live=(entry.evidence||[]).find((item)=>item.side==="live");
  if(live){
    lines.push(`  Match LIVE profile: **${live.device_class} / ${live.orientation} / viewport ${live.viewport_width}×${live.viewport_height} / DPR ${live.pixel_ratio} / evidence ${live.pixel_width}×${live.pixel_height}px**  `);
  }
  if(entry.notes)lines.push(`  ${entry.notes}`);
}
lines.push("","## LIVE capture still needed","")
for(const entry of live){
  lines.push(`- [ ] \`${entry.id}\` — ${entry.state}  `);
  lines.push(`  Capture group: **${entry.capture_group||"unassigned"}**  `);
  if(entry.notes)lines.push(`  ${entry.notes}`);
}
lines.push("","## Evidence registration command","",
"`node scripts/register-parity-evidence.mjs --id <parity-id> --side independent --file <screenshot> --source-label <session> --source-release ${manifest.fire_release} --route-family <parity-id> --device-class <mobile|tablet|desktop> --orientation <portrait|landscape> --viewport-width <px> --viewport-height <px> --pixel-ratio <n> --apply`",
"",
"Run `npm run release:strict-parity` after each capture batch.");
fs.writeFileSync(out,lines.join("\n")+"\n");
console.log(`Wrote ${path.relative(root,out)} — ${independent.length} independent + ${live.length} LIVE captures remaining.`);
