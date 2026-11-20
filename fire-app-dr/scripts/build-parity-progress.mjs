import fs from "node:fs";
import path from "node:path";

const root=path.resolve(new URL("..",import.meta.url).pathname);
const manifest=JSON.parse(fs.readFileSync(path.join(root,"PARITY_EVIDENCE_MANIFEST.json"),"utf8"));
const entries=manifest.entries||[];

const hasSide=(entry,side)=>(entry.evidence||[]).some((item)=>item.side===side);
const both=entries.filter((entry)=>hasSide(entry,"live")&&hasSide(entry,"independent"));
const comparisonReady=both.filter((entry)=>entry.comparison_status==="PENDING");
const mismatches=entries.filter((entry)=>entry.comparison_status==="MISMATCH");
const verified=entries.filter((entry)=>entry.comparison_status==="VERIFIED_IDENTICAL");

const progress={
  fire_release:manifest.fire_release,
  generated_at:new Date().toISOString(),
  total_states:entries.length,
  live_captured:entries.filter((entry)=>hasSide(entry,"live")).length,
  independent_captured:entries.filter((entry)=>hasSide(entry,"independent")).length,
  both_sides_captured:both.length,
  comparison_ready:comparisonReady.length,
  verified_identical:verified.length,
  mismatches:mismatches.length,
  pending:entries.filter((entry)=>entry.comparison_status==="PENDING").length,
  strict_parity_status:(verified.length===entries.length&&mismatches.length===0)?"FULL_IDENTICAL":"NOT_YET_FULLY_VERIFIED"
};
fs.writeFileSync(path.join(root,"PARITY_PROGRESS.json"),JSON.stringify(progress,null,2)+"\n");

const lines=[
  `# FIRE ${manifest.fire_release} — Parity Comparison Queue`,
  "",
  `Generated from the hash-bound evidence ledger.`,
  "",
  `- Both sides captured: **${both.length}/${entries.length}**`,
  `- Ready for comparison: **${comparisonReady.length}**`,
  `- Verified identical: **${verified.length}**`,
  `- Mismatches: **${mismatches.length}**`,
  "",
  "## Ready for comparison",
  ""
];
if(!comparisonReady.length)lines.push("_No parity states currently have both LIVE and independent evidence while still pending._");
for(const entry of comparisonReady){
  const live=(entry.evidence||[]).find((item)=>item.side==="live");
  const independent=(entry.evidence||[]).find((item)=>item.side==="independent");
  lines.push(`- [ ] \`${entry.id}\` — ${entry.state}`);
  lines.push(`  - LIVE: \`${live.file}\` — ${live.source_label}`);
  lines.push(`  - Independent: \`${independent.file}\` — ${independent.source_label}`);
}
lines.push("","## Current mismatches","");
if(!mismatches.length)lines.push("_No mismatches recorded._");
for(const entry of mismatches)lines.push(`- [ ] \`${entry.id}\` — ${entry.state}: ${entry.comparison?.notes||"No notes"}`);
lines.push("","## Comparison command","",
"`npm run parity:evidence:compare -- --id <parity-id> --result identical|mismatch --notes \"...\" --apply`");
fs.writeFileSync(path.join(root,"PARITY_COMPARISON_QUEUE.md"),lines.join("\n")+"\n");
console.log(`PASS  Parity progress: ${both.length} both-sides captured; ${comparisonReady.length} ready; ${verified.length} verified; ${mismatches.length} mismatches.`);
