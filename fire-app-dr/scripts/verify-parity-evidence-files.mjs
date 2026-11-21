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

const root=process.cwd();
const data=JSON.parse(fs.readFileSync(path.join(root,'PARITY_EVIDENCE_MANIFEST.json'),'utf8'));
let checked=0;
for (const e of data.entries||[]) {
  for (const ev of (e.evidence || [])) {
    const rel=String(ev.file||'');
    if(!rel.startsWith('evidence/'))throw new Error(`Unsafe/non-embedded evidence path: ${rel}`);
    const p=path.join(root,rel);
    if (!fs.existsSync(p)||!fs.statSync(p).isFile()) throw new Error(`Missing embedded evidence: ${rel}`);
    const bytes=fs.readFileSync(p);
    const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
    if(sha256!==ev.sha256)throw new Error(`Evidence SHA256 mismatch: ${rel}`);
    if(bytes.length!==Number(ev.bytes))throw new Error(`Evidence byte-size mismatch: ${rel}`);
    const dims=imageDimensions(bytes,path.extname(p));
    if((dims?.width??null)!==(ev.pixel_width??null)||(dims?.height??null)!==(ev.pixel_height??null))
      throw new Error(`Evidence pixel-dimension mismatch: ${rel}`);
    if(typeof ev.source_release!=="string"||ev.source_release.trim().length<2)throw new Error(`Evidence source release invalid: ${rel}`);
    if(!/^[a-f0-9]{64}$/.test(String(ev.source_fingerprint_sha256||"")))throw new Error(`Evidence source fingerprint invalid: ${rel}`);
    if(typeof ev.route_family!=="string"||ev.route_family.trim().length<3)throw new Error(`Evidence route family invalid: ${rel}`);
    if(!["mobile","tablet","desktop"].includes(ev.device_class))throw new Error(`Evidence device_class invalid: ${rel}`);
    if(!["portrait","landscape"].includes(ev.orientation))throw new Error(`Evidence orientation invalid: ${rel}`);
    if(!Number.isSafeInteger(Number(ev.viewport_width))||!Number.isSafeInteger(Number(ev.viewport_height)))throw new Error(`Evidence viewport invalid: ${rel}`);
    if(!Number.isFinite(Number(ev.pixel_ratio))||Number(ev.pixel_ratio)<=0)throw new Error(`Evidence pixel ratio invalid: ${rel}`);
    checked++;
  }
}
if(checked!==Number(data.evidence_file_count))throw new Error(`Evidence count mismatch: ${checked} vs ${data.evidence_file_count}`);
console.log(`PASS  Embedded parity evidence files SHA256/size verified: ${checked}`);
