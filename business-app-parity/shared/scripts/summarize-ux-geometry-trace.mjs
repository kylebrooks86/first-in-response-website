import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const dir=process.env.FIRE_UX_TRACE_DIR;
if(!dir)throw Error('Synthetic trace output directory required');
const files=readdirSync(dir).filter(f=>f.endsWith('.jsonl')),suites=[],reviews=[];
for(const file of files){
 const frames=readFileSync(resolve(dir,file),'utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));
 const seen=new Map();
 for(const frame of frames)for(const c of frame.controls)for(const flag of c.flags){
  const key=[c.id,c.tag,c.label,flag,frame.viewport.width,frame.theme].join('|');
  if(!seen.has(key))seen.set(key,{suite:file,flag,width:frame.viewport.width,theme:frame.theme,...c,disclosures:frame.disclosures});
 }
 suites.push({suite:file,observedStates:frames.length,widths:[...new Set(frames.map(f=>f.viewport.width))],observedControls:frames.reduce((n,f)=>n+f.controls.length,0),reviewCandidates:seen.size});
 reviews.push(...seen.values());
}
const summary={scope:'Passive actual-rendered states visited by existing synthetic localhost suites; not exhaustive state coverage, not physical iPhone, not automatic product failures. Small DOM/radio/checkbox targets require contextual review.',suites,reviewCandidates:reviews};
writeFileSync(resolve(dir,'summary.json'),JSON.stringify(summary,null,2));
writeFileSync(resolve(dir,'summary.md'),'# FIRE actual-rendered nested geometry observations\n\n'+summary.scope+'\n\n| Suite | Observed states | Widths | Control observations | Diagnostic candidates |\n|---|---:|---|---:|---:|\n'+suites.map(s=>'| '+s.suite+' | '+s.observedStates+' | '+s.widths.join(', ')+' | '+s.observedControls+' | '+s.reviewCandidates+' |').join('\n')+'\n\nA control observation can repeat across states and is not a unique control or passed check. Diagnostic candidates require review before being entered as defects. No tap-latency or keyboard/iOS acceptance is inferred.\n');
console.log(JSON.stringify({suites:suites.length,observedStates:suites.reduce((n,s)=>n+s.observedStates,0),controlObservations:suites.reduce((n,s)=>n+s.observedControls,0),diagnosticCandidates:reviews.length}));
