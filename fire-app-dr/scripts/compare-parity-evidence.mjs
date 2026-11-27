import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root=path.resolve(new URL("..",import.meta.url).pathname);
const manifestPath=path.join(root,"PARITY_EVIDENCE_MANIFEST.json");
const args=process.argv.slice(2);

const get=(name)=>{
  const i=args.indexOf(name);
  return i>=0?args[i+1]:null;
};
const flag=(name)=>args.includes(name);

const id=get("--id");
const result=get("--result");
const notes=(get("--notes")||"").trim();
const apply=flag("--apply");

if(!id||!["identical","mismatch"].includes(result||"")||notes.length<20){
  console.error("Usage: node scripts/compare-parity-evidence.mjs --id <parity-id> --result identical|mismatch --notes <at least 20 chars> [--apply]");
  process.exit(2);
}


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

const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
const entry=(manifest.entries||[]).find((candidate)=>candidate.id===id);
if(!entry)throw new Error(`Unknown parity evidence id: ${id}`);

const evidence=Array.isArray(entry.evidence)?entry.evidence:[];
const live=evidence.find((item)=>item.side==="live");
const independent=evidence.find((item)=>item.side==="independent");
if(!live||!independent)throw new Error(`Cannot compare ${id}: both LIVE and independent evidence must be registered first.`);

const verify=(item)=>{
  const rel=String(item.file||"");
  if(!rel||path.isAbsolute(rel)||rel.includes(".."))throw new Error(`Unsafe evidence path: ${rel}`);
  const abs=path.join(root,rel);
  if(!fs.existsSync(abs)||!fs.statSync(abs).isFile())throw new Error(`Evidence file missing: ${rel}`);
  const bytes=fs.readFileSync(abs);
  const sha256=crypto.createHash("sha256").update(bytes).digest("hex");
  if(sha256!==item.sha256)throw new Error(`Evidence hash mismatch: ${rel}`);
  if(bytes.length!==Number(item.bytes))throw new Error(`Evidence byte-size mismatch: ${rel}`);
  const dims=imageDimensions(bytes,path.extname(abs));
  if((dims?.width??null)!==(item.pixel_width??null)||(dims?.height??null)!==(item.pixel_height??null))
    throw new Error(`Evidence pixel-dimension metadata mismatch: ${rel}`);
  return {file:rel,sha256,bytes:bytes.length,width:dims?.width??null,height:dims?.height??null};
};
const liveVerified=verify(live);
const independentVerified=verify(independent);
const liveRegisteredAt=Date.parse(String(live.registered_at||""));
const independentRegisteredAt=Date.parse(String(independent.registered_at||""));
if(!Number.isFinite(liveRegisteredAt)||!Number.isFinite(independentRegisteredAt))
  throw new Error(`Cannot compare ${id}: evidence registration timestamps are missing or invalid.`);
if(!live.source_label||!independent.source_label)
  throw new Error(`Cannot compare ${id}: evidence source labels are missing.`);
if(!live.source_release||!independent.source_release)
  throw new Error(`Cannot compare ${id}: evidence source releases are missing.`);
if(!live.source_fingerprint_sha256||!independent.source_fingerprint_sha256)
  throw new Error(`Cannot compare ${id}: evidence source fingerprints are missing.`);
if(!live.route_family||!independent.route_family)
  throw new Error(`Cannot compare ${id}: evidence route families are missing.`);
if(result==="identical"&&live.route_family!==independent.route_family)
  throw new Error(`Cannot mark ${id} identical: LIVE and independent route families differ.`);
if(result==="identical"&&independent.source_release!==manifest.fire_release)
  throw new Error(`Cannot mark ${id} identical: independent evidence release ${independent.source_release} does not match current recovery release ${manifest.fire_release}.`);
if(result==="identical"&&independent.source_fingerprint_sha256!==manifest.shared_core_fingerprint_sha256)
  throw new Error(`Cannot mark ${id} identical: independent evidence fingerprint does not match the current recovery shared-core fingerprint.`);
const requiredProfileFields=["device_class","orientation","viewport_width","viewport_height","pixel_ratio"];
for(const field of requiredProfileFields){
  if(live[field]===undefined||live[field]===null||independent[field]===undefined||independent[field]===null)
    throw new Error(`Cannot compare ${id}: capture profile field ${field} is missing.`);
}
if(result==="identical"&&(
  live.device_class!==independent.device_class||
  live.orientation!==independent.orientation||
  Number(live.viewport_width)!==Number(independent.viewport_width)||
  Number(live.viewport_height)!==Number(independent.viewport_height)||
  Number(live.pixel_ratio)!==Number(independent.pixel_ratio)
)) throw new Error(`Cannot mark ${id} identical: LIVE and independent capture profiles differ.`);

if(result==="identical"&&(liveVerified.width!==independentVerified.width||liveVerified.height!==independentVerified.height))
  throw new Error(`Cannot mark ${id} identical: LIVE and independent screenshot dimensions differ (${liveVerified.width}x${liveVerified.height} vs ${independentVerified.width}x${independentVerified.height}).`);

const verdict=result==="identical"?"IDENTICAL":"MISMATCH";
const comparison={
  verdict,
  live_file:liveVerified.file,
  live_sha256:liveVerified.sha256,
  independent_file:independentVerified.file,
  independent_sha256:independentVerified.sha256,
  live_pixel_width:liveVerified.width,
  live_pixel_height:liveVerified.height,
  independent_pixel_width:independentVerified.width,
  independent_pixel_height:independentVerified.height,
  live_capture_profile:{
    device_class:live.device_class,
    orientation:live.orientation,
    viewport_width:live.viewport_width,
    viewport_height:live.viewport_height,
    pixel_ratio:live.pixel_ratio
  },
  independent_capture_profile:{
    device_class:independent.device_class,
    orientation:independent.orientation,
    viewport_width:independent.viewport_width,
    viewport_height:independent.viewport_height,
    pixel_ratio:independent.pixel_ratio
  },
  compared_at:new Date().toISOString(),
  live_registered_at:live.registered_at,
  independent_registered_at:independent.registered_at,
  live_source_label:live.source_label,
  independent_source_label:independent.source_label,
  live_source_release:live.source_release,
  independent_source_release:independent.source_release,
  live_source_fingerprint_sha256:live.source_fingerprint_sha256,
  independent_source_fingerprint_sha256:independent.source_fingerprint_sha256,
  live_route_family:live.route_family,
  independent_route_family:independent.route_family,
  notes
};

console.log(JSON.stringify({id,result,comparison,apply},null,2));
if(!apply){
  console.log("DRY RUN ONLY — add --apply to save the comparison verdict.");
  process.exit(0);
}

entry.comparison=comparison;
entry.comparison_status=result==="identical"?"VERIFIED_IDENTICAL":"MISMATCH";
entry.last_updated_at=comparison.compared_at;
manifest.fire_release="v130";
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n");
console.log(`SAVED ${entry.comparison_status} comparison for ${id}.`);
