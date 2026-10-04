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
const side=get("--side");
const source=get("--file");
const note=get("--note")||"";
const sourceLabel=(get("--source-label")||"").trim();
const sourceRelease=(get("--source-release")||"").trim();
const sourceFingerprint=(get("--source-fingerprint")||"").trim();
const routeFamily=(get("--route-family")||"").trim();
const deviceClass=(get("--device-class")||"").trim();
const orientation=(get("--orientation")||"").trim();
const viewportWidth=Number(get("--viewport-width"));
const viewportHeight=Number(get("--viewport-height"));
const pixelRatio=Number(get("--pixel-ratio"));
const apply=flag("--apply");

if(!id||!["live","independent"].includes(side||"")||!source||sourceLabel.length<3||sourceRelease.length<2||!/^[a-f0-9]{64}$/.test(sourceFingerprint)||routeFamily.length<3||
   !["mobile","tablet","desktop"].includes(deviceClass)||!["portrait","landscape"].includes(orientation)||
   !Number.isSafeInteger(viewportWidth)||viewportWidth<240||viewportWidth>10000||
   !Number.isSafeInteger(viewportHeight)||viewportHeight<240||viewportHeight>10000||
   !Number.isFinite(pixelRatio)||pixelRatio<=0||pixelRatio>10){
  console.error("Usage: node scripts/register-parity-evidence.mjs --id <parity-id> --side live|independent --file <image-path> --source-label <deployment/session label> --source-release <release label> --source-fingerprint <64-char shared-core SHA256> --route-family <stable route/state family> --device-class mobile|tablet|desktop --orientation portrait|landscape --viewport-width <px> --viewport-height <px> --pixel-ratio <number> [--note <text>] [--apply]");
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

const sourceAbs=path.resolve(source);
if(!fs.existsSync(sourceAbs)||!fs.statSync(sourceAbs).isFile())throw new Error(`Evidence file not found: ${sourceAbs}`);
const ext=path.extname(sourceAbs).toLowerCase();
if(![".png",".jpg",".jpeg",".webp",".pdf"].includes(ext))throw new Error(`Unsupported evidence file type: ${ext}`);

const safeId=id.replace(/[^a-zA-Z0-9._-]+/g,"-");
const destRel=`evidence/${side}/${safeId}${ext}`;
const destAbs=path.join(root,destRel);
const bytes=fs.readFileSync(sourceAbs);
const sha256=crypto.createHash("sha256").update(bytes).digest("hex");
const dimensions=imageDimensions(bytes,ext);

const existingOwner=(manifest.entries||[]).find((candidate)=>
  candidate.id!==id&&(candidate.evidence||[]).some((item)=>item.file===destRel)
);
if(existingOwner)throw new Error(`Destination evidence path is already assigned to ${existingOwner.id}: ${destRel}`);

const existing=(entry.evidence||[]).find((item)=>item.side===side);
const plan={
  id,side,source:sourceAbs,destination:destRel,bytes:bytes.length,sha256,
  replacing:existing?.file||null,apply
};
console.log(JSON.stringify(plan,null,2));
if(!apply){
  console.log("DRY RUN ONLY — add --apply to copy the evidence and update the manifest.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(destAbs),{recursive:true});
fs.copyFileSync(sourceAbs,destAbs);

entry.evidence=(entry.evidence||[]).filter((item)=>item.side!==side);
const registeredAt=new Date().toISOString();
entry.evidence.push({
  side,
  file:destRel,
  sha256,
  bytes:bytes.length,
  media_type:ext.slice(1),
  pixel_width:dimensions?.width??null,
  pixel_height:dimensions?.height??null,
  device_class:deviceClass,
  orientation,
  viewport_width:viewportWidth,
  viewport_height:viewportHeight,
  pixel_ratio:pixelRatio,
  source_environment:side,
  source_label:sourceLabel,
  source_release:sourceRelease,
  source_fingerprint_sha256:sourceFingerprint,
  route_family:routeFamily,
  registered_at:registeredAt,
  note:note||`${side==="live"?"LIVE":"Independent"} parity capture for ${id}.`
});
if(side==="live")entry.live_evidence_status="CAPTURED";
if(side==="independent")entry.independent_evidence_status="CAPTURED";

const hasLive=entry.evidence.some((item)=>item.side==="live");
const hasIndependent=entry.evidence.some((item)=>item.side==="independent");
// Any changed/re-registered evidence invalidates the old comparison verdict.
// A fresh hash-bound comparison is required even when both sides remain present.
entry.comparison_status="PENDING";
delete entry.comparison;
entry.last_updated_at=new Date().toISOString();

manifest.fire_release="v130";
manifest.evidence_hash_algorithm="sha256";
manifest.evidence_file_count=manifest.entries.reduce((sum,item)=>sum+(item.evidence?.length||0),0);
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n");
console.log(`REGISTERED ${side} evidence for ${id}: ${destRel}`);
