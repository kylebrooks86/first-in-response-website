import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';


function imageDimensions(bytes,ext){
  const normalized=ext.toLowerCase();
  if(normalized===".png"){
    if(bytes.length<24||bytes.toString("ascii",1,4)!=="PNG")throw new Error("Invalid PNG evidence.");
    return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
  }
  if(normalized===".jpg"||normalized===".jpeg"){
    if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8)throw new Error("Invalid JPEG evidence.");
    let offset=2;
    const sof=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
    while(offset+4<=bytes.length){
      if(bytes[offset]!==0xff){offset++;continue;}
      let marker=bytes[offset+1];
      while(marker===0xff){offset++;marker=bytes[offset+1];}
      if(marker===0xd9||marker===0xda)break;
      const len=bytes.readUInt16BE(offset+2);
      if(sof.has(marker)){
        if(offset+8>bytes.length)break;
        return {height:bytes.readUInt16BE(offset+5),width:bytes.readUInt16BE(offset+7)};
      }
      if(len<2)break;
      offset+=2+len;
    }
    throw new Error("Could not read JPEG dimensions.");
  }
  if(normalized===".webp"){
    if(bytes.length<30||bytes.toString("ascii",0,4)!=="RIFF"||bytes.toString("ascii",8,12)!=="WEBP")throw new Error("Invalid WebP evidence.");
    const chunk=bytes.toString("ascii",12,16);
    if(chunk==="VP8X"){
      const width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);
      const height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);
      return {width,height};
    }
    throw new Error("Unsupported WebP evidence encoding; use PNG/JPEG or VP8X WebP.");
  }
  return null;
}

const root = process.cwd();
const matrixPath = path.join(root, 'STRICT_PARITY_MATRIX.md');
const manifestPath = path.join(root, 'FIRE_UNIFIED_RELEASE.json');
const evidencePath = path.join(root, 'PARITY_EVIDENCE_MANIFEST.json');
const checklistPath = path.join(root, 'LIVE_MASTER_PARITY_CHECKLIST.md');
const sealPath = path.join(root, 'RELEASE_EVIDENCE_SEAL.json');
if (!fs.existsSync(matrixPath)) throw new Error('Missing STRICT_PARITY_MATRIX.md');
if (!fs.existsSync(manifestPath)) throw new Error('Missing FIRE_UNIFIED_RELEASE.json');
if (!fs.existsSync(evidencePath)) throw new Error('Missing PARITY_EVIDENCE_MANIFEST.json');
if (!fs.existsSync(checklistPath)) throw new Error('Missing LIVE_MASTER_PARITY_CHECKLIST.md');
if (!fs.existsSync(sealPath)) throw new Error('Missing RELEASE_EVIDENCE_SEAL.json');

const matrix = fs.readFileSync(matrixPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const checklist = fs.readFileSync(checklistPath, 'utf8');
const seal = JSON.parse(fs.readFileSync(sealPath, 'utf8'));
const tableRows = matrix.split('\n')
  .filter((line) => line.startsWith('|') && !line.startsWith('|---') && !line.includes('Area / state') && !line.includes('Behavior |'))
  .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()))
  .filter((cells) => cells.length >= 3);

const statusRows = tableRows.map((cells) => ({ area: cells[0], status: cells[1] }));
const verifiedRows = statusRows.filter((row) => row.status.includes('VERIFIED IDENTICAL'));
const functionalRows = statusRows.filter((row) => row.status.includes('FUNCTIONALLY VERIFIED'));
const needsVisualRows = statusRows.filter((row) => row.status.includes('NEEDS LIVE VISUAL'));
const infrastructureRows = statusRows.filter((row) => row.status.includes('INFRASTRUCTURE ONLY'));
const liveBehaviorRows = statusRows.filter((row) => row.status.includes('LIVE BEHAVIOR CAPTURED'));
const liveEvidenceRows = statusRows.filter((row) => row.status.includes('LIVE EVIDENCE CAPTURED'));
const blockerRows = statusRows.filter((row) => row.status.includes('FUNCTIONALLY VERIFIED') || row.status.includes('NEEDS LIVE VISUAL') || row.status.includes('LIVE BEHAVIOR CAPTURED') || row.status.includes('LIVE EVIDENCE CAPTURED'));
const verified = verifiedRows.length;
const functional = functionalRows.length;
const needsVisual = needsVisualRows.length;
const infrastructure = infrastructureRows.length;
const liveBehavior = liveBehaviorRows.length;
const liveEvidence = liveEvidenceRows.length;
const blockers = blockerRows.length;

if (manifest.strict_parity_required !== true) throw new Error('strict_parity_required must be true');
if (manifest.strict_parity_matrix !== 'STRICT_PARITY_MATRIX.md') throw new Error('strict_parity_matrix must point to STRICT_PARITY_MATRIX.md');
if(seal.fire_release!==manifest.fire_release||seal.shared_core_fingerprint_sha256!==manifest.shared_core_fingerprint_sha256)
  throw new Error("Release evidence seal does not match the current release/shared-core fingerprint");
const sealHash=crypto.createHash("sha256");
let sealCount=0;
for(const item of seal.sealed_files||[]){
  const abs=path.join(root,String(item.path||""));
  if(!fs.existsSync(abs)||!fs.statSync(abs).isFile())throw new Error(`Release evidence seal file missing: ${item.path}`);
  const bytes=fs.readFileSync(abs);
  const digest=crypto.createHash("sha256").update(bytes).digest("hex");
  if(digest!==item.sha256||bytes.length!==Number(item.bytes))throw new Error(`Release evidence seal drift: ${item.path}`);
  sealHash.update(item.path);sealHash.update("\0");sealHash.update(digest);sealHash.update("\0");sealHash.update(String(bytes.length));sealHash.update("\n");
  sealCount++;
}
if(sealCount!==Number(seal.sealed_file_count)||sealHash.digest("hex")!==seal.seal_sha256)
  throw new Error("Release evidence seal digest/count mismatch");

if(evidence.shared_core_fingerprint_sha256!==manifest.shared_core_fingerprint_sha256)
  throw new Error(`Parity evidence fingerprint ${evidence.shared_core_fingerprint_sha256} does not match unified shared-core fingerprint ${manifest.shared_core_fingerprint_sha256}`);

const declared = manifest.strict_parity_status;

const unresolvedEvidence = evidence.entries.filter((e) => e.comparison_status !== 'VERIFIED_IDENTICAL');
const liveCaptured = evidence.entries.filter((e) => (Array.isArray(e.evidence) ? e.evidence : []).some((x) => x.side === 'live'));
const livePending = evidence.entries.filter((e) => !(Array.isArray(e.evidence) ? e.evidence : []).some((x) => x.side === 'live'));
const independentCaptured = evidence.entries.filter((e) => (Array.isArray(e.evidence) ? e.evidence : []).some((x) => x.side === 'independent'));
const independentPending = evidence.entries.filter((e) => !(Array.isArray(e.evidence) ? e.evidence : []).some((x) => x.side === 'independent'));
const falselyVerified = evidence.entries.filter((e) => {
  if (e.comparison_status !== 'VERIFIED_IDENTICAL') return false;
  const ev = Array.isArray(e.evidence) ? e.evidence : [];
  return !ev.some((x) => x.side === 'live') || !ev.some((x) => x.side === 'independent');
});
const evidenceIds=evidence.entries.map((e)=>String(e.id||""));
const duplicateEvidenceIds=evidenceIds.filter((id,index)=>!id||evidenceIds.indexOf(id)!==index);
if(duplicateEvidenceIds.length)throw new Error(`Parity evidence contains duplicate/blank IDs: ${[...new Set(duplicateEvidenceIds)].join(", ")}`);

const checklistIds=[...checklist.matchAll(/`((?:owner-app|customer-facing|shared-business)-[^`]+)`/g)].map((match)=>match[1]);
const duplicateChecklistIds=checklistIds.filter((id,index)=>checklistIds.indexOf(id)!==index);
if(duplicateChecklistIds.length)throw new Error(`Parity checklist contains duplicate IDs: ${[...new Set(duplicateChecklistIds)].join(", ")}`);
const evidenceIdSet=new Set(evidenceIds);
const checklistIdSet=new Set(checklistIds);
const missingChecklist=evidenceIds.filter((id)=>!checklistIdSet.has(id));
const missingEvidence=checklistIds.filter((id)=>!evidenceIdSet.has(id));
if(missingChecklist.length||missingEvidence.length)throw new Error(`Parity checklist/evidence IDs disagree. Missing from checklist: ${missingChecklist.join(", ")||"none"}; missing from evidence: ${missingEvidence.join(", ")||"none"}`);

let referencedEvidenceFiles=0;
const evidenceFileOwners=new Map();
for(const entry of evidence.entries){
  const evs=Array.isArray(entry.evidence)?entry.evidence:[];
  for(const item of evs){
    referencedEvidenceFiles++;
    if(!['live','independent'].includes(item.side))throw new Error(`Evidence ${entry.id} has invalid side ${item.side}`);
    const rel=String(item.file||"");
    if(!rel||path.isAbsolute(rel)||rel.includes(".."))throw new Error(`Evidence ${entry.id} has unsafe file path ${rel}`);
    const abs=path.join(root,rel);
    if(!fs.existsSync(abs)||!fs.statSync(abs).isFile())throw new Error(`Evidence ${entry.id} references missing file ${rel}`);
    const bytes=fs.readFileSync(abs);
    const digest=crypto.createHash('sha256').update(bytes).digest('hex');
    if(item.sha256!==digest)throw new Error(`Evidence ${entry.id} hash mismatch for ${rel}`);
    if(Number(item.bytes)!==bytes.length)throw new Error(`Evidence ${entry.id} byte-size mismatch for ${rel}`);
    const dims=imageDimensions(bytes,path.extname(abs));
    if((dims?.width??null)!==(item.pixel_width??null)||(dims?.height??null)!==(item.pixel_height??null))
      throw new Error(`Evidence ${entry.id} pixel dimensions no longer match registered metadata for ${rel}`);
    if(item.source_environment!==item.side)throw new Error(`Evidence ${entry.id} source_environment must match side ${item.side}`);
    if(typeof item.source_label!=="string"||item.source_label.trim().length<3)throw new Error(`Evidence ${entry.id} is missing a meaningful source_label`);
    if(typeof item.source_release!=="string"||item.source_release.trim().length<2)throw new Error(`Evidence ${entry.id} is missing source_release`);
    if(!/^[a-f0-9]{64}$/.test(String(item.source_fingerprint_sha256||"")))throw new Error(`Evidence ${entry.id} is missing a valid source fingerprint`);
    if(typeof item.route_family!=="string"||item.route_family.trim().length<3)throw new Error(`Evidence ${entry.id} is missing route_family`);
    if(!["mobile","tablet","desktop"].includes(item.device_class))throw new Error(`Evidence ${entry.id} has invalid device_class`);
    if(!["portrait","landscape"].includes(item.orientation))throw new Error(`Evidence ${entry.id} has invalid orientation`);
    if(!Number.isSafeInteger(Number(item.viewport_width))||Number(item.viewport_width)<240||Number(item.viewport_width)>10000)throw new Error(`Evidence ${entry.id} has invalid viewport_width`);
    if(!Number.isSafeInteger(Number(item.viewport_height))||Number(item.viewport_height)<240||Number(item.viewport_height)>10000)throw new Error(`Evidence ${entry.id} has invalid viewport_height`);
    if(!Number.isFinite(Number(item.pixel_ratio))||Number(item.pixel_ratio)<=0||Number(item.pixel_ratio)>10)throw new Error(`Evidence ${entry.id} has invalid pixel_ratio`);
    const registeredAt=Date.parse(String(item.registered_at||""));
    if(!Number.isFinite(registeredAt))throw new Error(`Evidence ${entry.id} has invalid registered_at for ${rel}`);
    const prior=evidenceFileOwners.get(rel);
    if(prior&&prior!==entry.id){
      const allowed=item.shared_evidence===true&&Array.isArray(item.shared_with)&&item.shared_with.includes(prior)&&typeof item.shared_reason==="string"&&item.shared_reason.trim().length>=20;
      const priorEntry=evidence.entries.find((candidate)=>candidate.id===prior);
      const priorItem=(priorEntry?.evidence||[]).find((candidate)=>candidate.file===rel);
      const reciprocal=priorItem?.shared_evidence===true&&Array.isArray(priorItem.shared_with)&&priorItem.shared_with.includes(entry.id)&&typeof priorItem.shared_reason==="string"&&priorItem.shared_reason.trim().length>=20;
      if(!allowed||!reciprocal)throw new Error(`Evidence file ${rel} is assigned to more than one parity entry without reciprocal shared-evidence justification (${prior}, ${entry.id})`);
    }else{
      evidenceFileOwners.set(rel,entry.id);
    }
  }
  const hasLive=evs.some((x)=>x.side==='live');
  const hasIndependent=evs.some((x)=>x.side==='independent');
  const expectedLiveStatus=hasLive?'CAPTURED':'PENDING';
  if(entry.live_evidence_status!==expectedLiveStatus)throw new Error(`Evidence ${entry.id} live_evidence_status=${entry.live_evidence_status} but actual files imply ${expectedLiveStatus}`);
  if(entry.independent_evidence_status==='CAPTURED'&&!hasIndependent)throw new Error(`Evidence ${entry.id} claims independent CAPTURED without an independent evidence file`);
  if(hasIndependent&&entry.independent_evidence_status!=='CAPTURED')throw new Error(`Evidence ${entry.id} has independent evidence but status is ${entry.independent_evidence_status}`);
  if(entry.comparison_status==='VERIFIED_IDENTICAL'&&(!hasLive||!hasIndependent))throw new Error(`Evidence ${entry.id} cannot be VERIFIED_IDENTICAL without both sides`);
  if(entry.comparison_status==='VERIFIED_IDENTICAL'||entry.comparison_status==='MISMATCH'){
    if(!hasLive||!hasIndependent)throw new Error(`Evidence ${entry.id} comparison requires both LIVE and independent files`);
    const live=evs.find((x)=>x.side==='live');
    const independent=evs.find((x)=>x.side==='independent');
    const comparison=entry.comparison;
    if(!comparison||!['IDENTICAL','MISMATCH'].includes(comparison.verdict))throw new Error(`Evidence ${entry.id} is missing a valid hash-bound comparison record`);
    const expectedVerdict=entry.comparison_status==='VERIFIED_IDENTICAL'?'IDENTICAL':'MISMATCH';
    if(comparison.verdict!==expectedVerdict)throw new Error(`Evidence ${entry.id} comparison verdict disagrees with comparison_status`);
    if(comparison.live_sha256!==live.sha256||comparison.independent_sha256!==independent.sha256)
      throw new Error(`Evidence ${entry.id} comparison hashes no longer match the registered evidence`);
    if(comparison.live_file!==live.file||comparison.independent_file!==independent.file)
      throw new Error(`Evidence ${entry.id} comparison files no longer match the registered evidence`);
    if(comparison.live_registered_at!==live.registered_at||comparison.independent_registered_at!==independent.registered_at)
      throw new Error(`Evidence ${entry.id} comparison registration timestamps no longer match current evidence`);
    if(comparison.live_source_label!==live.source_label||comparison.independent_source_label!==independent.source_label)
      throw new Error(`Evidence ${entry.id} comparison source labels no longer match current evidence`);
    if(comparison.live_source_release!==live.source_release||comparison.independent_source_release!==independent.source_release)
      throw new Error(`Evidence ${entry.id} comparison source releases no longer match current evidence`);
    if(comparison.live_source_fingerprint_sha256!==live.source_fingerprint_sha256||comparison.independent_source_fingerprint_sha256!==independent.source_fingerprint_sha256)
      throw new Error(`Evidence ${entry.id} comparison source fingerprints no longer match current evidence`);
    if(comparison.live_route_family!==live.route_family||comparison.independent_route_family!==independent.route_family)
      throw new Error(`Evidence ${entry.id} comparison route families no longer match current evidence`);
    if((comparison.live_pixel_width??null)!==(live.pixel_width??null)||(comparison.live_pixel_height??null)!==(live.pixel_height??null)||
       (comparison.independent_pixel_width??null)!==(independent.pixel_width??null)||(comparison.independent_pixel_height??null)!==(independent.pixel_height??null))
      throw new Error(`Evidence ${entry.id} comparison pixel dimensions no longer match current evidence`);
    const liveProfile=comparison.live_capture_profile;
    const independentProfile=comparison.independent_capture_profile;
    if(!liveProfile||!independentProfile)throw new Error(`Evidence ${entry.id} comparison capture profiles are missing`);
    for(const field of ["device_class","orientation","viewport_width","viewport_height","pixel_ratio"]){
      if(liveProfile[field]!==live[field]||independentProfile[field]!==independent[field])
        throw new Error(`Evidence ${entry.id} comparison capture profile no longer matches current evidence`);
    }
    if(entry.comparison_status==='VERIFIED_IDENTICAL'&&live.route_family!==independent.route_family)
      throw new Error(`Evidence ${entry.id} cannot be VERIFIED_IDENTICAL when route families differ`);
    if(entry.comparison_status==='VERIFIED_IDENTICAL'&&independent.source_release!==evidence.fire_release)
      throw new Error(`Evidence ${entry.id} cannot be VERIFIED_IDENTICAL with independent release ${independent.source_release}; current recovery release is ${evidence.fire_release}`);
    if(entry.comparison_status==='VERIFIED_IDENTICAL'&&independent.source_fingerprint_sha256!==evidence.shared_core_fingerprint_sha256)
      throw new Error(`Evidence ${entry.id} cannot be VERIFIED_IDENTICAL with a different independent shared-core fingerprint`);
    if(entry.comparison_status==='VERIFIED_IDENTICAL'&&(
      live.device_class!==independent.device_class||
      live.orientation!==independent.orientation||
      Number(live.viewport_width)!==Number(independent.viewport_width)||
      Number(live.viewport_height)!==Number(independent.viewport_height)||
      Number(live.pixel_ratio)!==Number(independent.pixel_ratio)
    )) throw new Error(`Evidence ${entry.id} cannot be VERIFIED_IDENTICAL when capture profiles differ`);
    if(entry.comparison_status==='VERIFIED_IDENTICAL'&&
       ((live.pixel_width??null)!==(independent.pixel_width??null)||(live.pixel_height??null)!==(independent.pixel_height??null)))
      throw new Error(`Evidence ${entry.id} cannot be VERIFIED_IDENTICAL when screenshot dimensions differ`);
    const comparedAt=Date.parse(String(comparison.compared_at||""));
    const liveRegisteredAt=Date.parse(String(live.registered_at||""));
    const independentRegisteredAt=Date.parse(String(independent.registered_at||""));
    if(!Number.isFinite(comparedAt)||comparedAt<liveRegisteredAt||comparedAt<independentRegisteredAt)
      throw new Error(`Evidence ${entry.id} comparison predates the evidence registration it claims to compare`);
    if(typeof comparison.notes!=='string'||comparison.notes.trim().length<20)
      throw new Error(`Evidence ${entry.id} comparison notes are missing or too short`);
  }
}
if(Number(evidence.evidence_file_count)!==referencedEvidenceFiles)throw new Error(`Evidence file count ${evidence.evidence_file_count} does not match ${referencedEvidenceFiles} referenced files`);
if(evidence.evidence_hash_algorithm!=='sha256')throw new Error('Parity evidence hash algorithm must be sha256');

const malformedStatuses = evidence.entries.filter((e) => !['PENDING','VERIFIED_IDENTICAL','MISMATCH'].includes(e.comparison_status));
if (evidence.fire_release !== manifest.fire_release) throw new Error(`Evidence release ${evidence.fire_release} does not match unified release ${manifest.fire_release}`);
if (evidence.entry_count !== evidence.entries.length) throw new Error('Parity evidence entry_count does not match entries length');
if (falselyVerified.length) throw new Error(`Found ${falselyVerified.length} VERIFIED_IDENTICAL entries without both LIVE and independent evidence`);
if (malformedStatuses.length) throw new Error(`Found ${malformedStatuses.length} entries with invalid comparison_status`);
if (evidence.entries.length !== blockers) throw new Error(`Parity evidence ledger has ${evidence.entries.length} entries but strict matrix has ${blockers} blockers`);
if (declared === 'FULL_IDENTICAL' && unresolvedEvidence.length > 0) {
  throw new Error(`Cannot declare FULL_IDENTICAL with ${unresolvedEvidence.length} unresolved evidence entries`);
}

if (blockers > 0 && declared === 'FULL_IDENTICAL') {
  throw new Error(`Cannot declare FULL_IDENTICAL with ${blockers} unresolved parity entries (${functional} functional-only, ${needsVisual} needs-live-visual)`);
}
if (blockers === 0 && declared !== 'FULL_IDENTICAL') {
  throw new Error('All parity blockers are closed; manifest should declare FULL_IDENTICAL');
}
if (blockers > 0 && declared !== 'NOT_YET_FULLY_VERIFIED') {
  throw new Error(`Expected strict_parity_status NOT_YET_FULLY_VERIFIED while blockers remain; found ${declared}`);
}

console.log(`PASS  Strict parity matrix present`);
console.log(`PASS  Verified-identical markers: ${verified}`);
console.log(`PASS  Infrastructure-only markers: ${infrastructure}`);
console.log(`PASS  LIVE-behavior-captured blockers: ${liveBehavior}`);
console.log(`PASS  LIVE-evidence-captured blockers: ${liveEvidence}`);
console.log(`PASS  Exact evidence ledger entries: ${evidence.entries.length}`);
console.log(`PASS  Parity checklist/evidence IDs: ${evidence.entries.length}/${evidence.entries.length} exact match`);
console.log(`PASS  Evidence files verified by SHA256: ${referencedEvidenceFiles}`);
console.log(`PASS  Shared evidence reuse requires reciprocal declaration + justification`);
console.log(`PASS  Evidence provenance labels + registration chronology validated`);
console.log(`PASS  Evidence pixel dimensions verified and identical verdicts require matching image size`);
console.log(`PASS  Capture profile metadata validated and identical verdicts require matching context`);
console.log(`PASS  Deployment release + route-family provenance validated`);
console.log(`PASS  Shared-core fingerprint chain validated across release, evidence, and comparisons`);
console.log(`PASS  Release evidence seal validated: ${sealCount} files`);
console.log(`INFO  LIVE evidence captured: ${liveCaptured.length}/${evidence.entries.length}`);
console.log(`INFO  LIVE evidence still needed: ${livePending.length}`);
console.log(`INFO  Independent evidence captured: ${independentCaptured.length}/${evidence.entries.length}`);
console.log(`INFO  Independent evidence still needed: ${independentPending.length}`);
console.log(`INFO  Evidence comparisons still pending: ${unresolvedEvidence.length}`);
if (blockers > 0) {
  console.log(`PASS  Release correctly remains NOT_YET_FULLY_VERIFIED`);
  console.log(`INFO  Remaining strict-parity blockers: ${blockers} (${functional} functionally verified only; ${needsVisual} need LIVE visual verification; ${liveBehavior} have LIVE behavior captured; ${liveEvidence} have LIVE visual evidence captured but still need independent rendered comparison)`);
} else {
  console.log('PASS  FULL_IDENTICAL is justified by the matrix');
}
